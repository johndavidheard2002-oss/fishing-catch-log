package com.tidemark.logbook;

import android.app.Activity;
import com.android.billingclient.api.AcknowledgePurchaseParams;
import com.android.billingclient.api.BillingClient;
import com.android.billingclient.api.BillingClientStateListener;
import com.android.billingclient.api.BillingFlowParams;
import com.android.billingclient.api.BillingResult;
import com.android.billingclient.api.PendingPurchasesParams;
import com.android.billingclient.api.ProductDetails;
import com.android.billingclient.api.Purchase;
import com.android.billingclient.api.PurchasesUpdatedListener;
import com.android.billingclient.api.QueryProductDetailsParams;
import com.android.billingclient.api.QueryPurchasesParams;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Google Play Billing bridge for Tide Mark Plan.
 * Product id {@code tidemark_plan_yearly}, base plan {@code yearly},
 * offer {@code free-month}. The JS name matches the iOS StoreKit plugin
 * so the live site can call TideMarkStore on either shell.
 */
@CapacitorPlugin(name = "TideMarkStore")
public class TideMarkStorePlugin extends Plugin {
    static final String PRODUCT_ID = "tidemark_plan_yearly";
    static final String BASE_PLAN_ID = "yearly";
    static final String OFFER_ID = "free-month";
    private static final Pattern PERIOD = Pattern.compile("^P(\\d+)([DWMY])$");

    private BillingClient billingClient;
    private boolean connecting = false;
    private final List<ReadyTask> pendingReady = new ArrayList<>();
    private PluginCall pendingPurchase;

    private static final class ReadyTask {
        final PluginCall call;
        final Runnable action;

        ReadyTask(PluginCall call, Runnable action) {
            this.call = call;
            this.action = action;
        }
    }

    private final PurchasesUpdatedListener purchasesUpdatedListener = (billingResult, purchases) -> {
        PluginCall call;
        synchronized (this) {
            call = pendingPurchase;
            pendingPurchase = null;
        }
        if (call == null) {
            acknowledgeQuietly(purchases);
            return;
        }
        int code = billingResult.getResponseCode();
        if (code == BillingClient.BillingResponseCode.USER_CANCELED) {
            call.reject("Purchase cancelled.", "USER_CANCELLED");
            return;
        }
        if (code == BillingClient.BillingResponseCode.ITEM_ALREADY_OWNED) {
            resolveOwned(call, true);
            return;
        }
        if (code != BillingClient.BillingResponseCode.OK) {
            call.reject(messageOr(billingResult, "Purchase failed."));
            return;
        }
        Purchase match = findPlan(purchases);
        if (match == null) {
            call.reject("Purchase failed.");
            return;
        }
        acknowledgeThen(match, () -> finishPurchase(call, match, true));
    };

    @Override
    protected void handleOnDestroy() {
        if (billingClient != null) {
            billingClient.endConnection();
            billingClient = null;
        }
        super.handleOnDestroy();
    }

    @PluginMethod
    public void getProduct(PluginCall call) {
        whenReady(call, () -> queryProduct(call, (product, error) -> {
            if (product == null) {
                call.reject(error != null ? error : "Google Play product " + PRODUCT_ID + " is not available.");
                return;
            }
            JSObject body = new JSObject();
            body.put("productId", PRODUCT_ID);
            applyOffer(body, chooseOffer(product));
            String name = product.getName();
            body.put("displayName", name == null || name.isEmpty() ? "Tide Mark Plan" : name);
            call.resolve(body);
        }));
    }

    @PluginMethod
    public void planOffer(PluginCall call) {
        whenReady(call, () -> queryProduct(call, (product, error) -> queryPurchases(call, (purchase, purchaseError) -> {
            if (product == null && purchase == null && error != null && purchaseError != null) {
                call.reject(error);
                return;
            }
            call.resolve(offerPayload(product, purchase, null));
        })));
    }

    @PluginMethod
    public void purchase(PluginCall call) {
        whenReady(call, () -> queryProduct(call, (product, error) -> {
            if (product == null) {
                call.reject(error != null ? error : "Google Play product " + PRODUCT_ID + " is not available.");
                return;
            }
            ProductDetails.SubscriptionOfferDetails offer = chooseOffer(product);
            if (offer == null) {
                call.reject("Google Play subscription offer is not available.");
                return;
            }
            Activity activity = getActivity();
            if (activity == null) {
                call.reject("Google Play billing is not available.");
                return;
            }
            synchronized (TideMarkStorePlugin.this) {
                if (pendingPurchase != null) {
                    call.reject("A purchase is already in progress.");
                    return;
                }
                pendingPurchase = call;
            }
            BillingFlowParams.ProductDetailsParams details = BillingFlowParams.ProductDetailsParams.newBuilder()
                .setProductDetails(product)
                .setOfferToken(offer.getOfferToken())
                .build();
            BillingFlowParams flow = BillingFlowParams.newBuilder()
                .setProductDetailsParamsList(Collections.singletonList(details))
                .build();
            activity.runOnUiThread(() -> {
                BillingResult launched = billingClient.launchBillingFlow(activity, flow);
                if (launched.getResponseCode() != BillingClient.BillingResponseCode.OK) {
                    synchronized (TideMarkStorePlugin.this) {
                        if (pendingPurchase == call) pendingPurchase = null;
                    }
                    call.reject(messageOr(launched, "Purchase failed."));
                }
            });
        }));
    }

    @PluginMethod
    public void restore(PluginCall call) {
        whenReady(call, () -> queryProduct(call, (product, error) -> queryPurchases(call, (purchase, purchaseError) -> {
            boolean entitled = purchase != null;
            JSObject body = offerPayload(product, purchase, entitled);
            if (!entitled) body.put("restored", false);
            call.resolve(body);
        })));
    }

    private void ensureClient() {
        if (billingClient != null) return;
        billingClient = BillingClient.newBuilder(getContext())
            .setListener(purchasesUpdatedListener)
            .enablePendingPurchases(PendingPurchasesParams.newBuilder().enableOneTimeProducts().build())
            .build();
    }

    private void whenReady(PluginCall call, Runnable action) {
        Activity activity = getActivity();
        if (activity == null) {
            call.reject("Google Play billing is not available.");
            return;
        }
        activity.runOnUiThread(() -> {
            ensureClient();
            if (billingClient.isReady()) {
                action.run();
                return;
            }
            pendingReady.add(new ReadyTask(call, action));
            if (connecting) return;
            connecting = true;
            billingClient.startConnection(new BillingClientStateListener() {
                @Override
                public void onBillingSetupFinished(BillingResult result) {
                    connecting = false;
                    List<ReadyTask> tasks = new ArrayList<>(pendingReady);
                    pendingReady.clear();
                    if (result.getResponseCode() != BillingClient.BillingResponseCode.OK) {
                        for (ReadyTask task : tasks) {
                            task.call.reject("Google Play billing is not available.");
                        }
                        return;
                    }
                    for (ReadyTask task : tasks) task.action.run();
                }

                @Override
                public void onBillingServiceDisconnected() {
                    connecting = false;
                }
            });
        });
    }

    private interface ProductCallback {
        void onProduct(ProductDetails product, String error);
    }

    private interface PurchaseCallback {
        void onPurchase(Purchase purchase, String error);
    }

    private void queryProduct(PluginCall call, ProductCallback callback) {
        List<QueryProductDetailsParams.Product> products = new ArrayList<>();
        products.add(
            QueryProductDetailsParams.Product.newBuilder()
                .setProductId(PRODUCT_ID)
                .setProductType(BillingClient.ProductType.SUBS)
                .build()
        );
        QueryProductDetailsParams params = QueryProductDetailsParams.newBuilder().setProductList(products).build();
        // Billing 8+: the listener receives a QueryProductDetailsResult. Products Play
        // could not fetch are listed in getUnfetchedProductList() instead of being dropped.
        billingClient.queryProductDetailsAsync(params, (billingResult, result) -> {
            if (billingResult.getResponseCode() != BillingClient.BillingResponseCode.OK) {
                callback.onProduct(null, messageOr(billingResult, "Google Play product " + PRODUCT_ID + " is not available."));
                return;
            }
            List<ProductDetails> productDetailsList = result == null ? null : result.getProductDetailsList();
            if (productDetailsList == null) {
                callback.onProduct(null, "Google Play product " + PRODUCT_ID + " is not available.");
                return;
            }
            for (ProductDetails details : productDetailsList) {
                if (PRODUCT_ID.equals(details.getProductId())) {
                    callback.onProduct(details, null);
                    return;
                }
            }
            callback.onProduct(null, "Google Play product " + PRODUCT_ID + " is not available.");
        });
    }

    private void queryPurchases(PluginCall call, PurchaseCallback callback) {
        QueryPurchasesParams params = QueryPurchasesParams.newBuilder()
            .setProductType(BillingClient.ProductType.SUBS)
            .build();
        billingClient.queryPurchasesAsync(params, (billingResult, purchases) -> {
            if (billingResult.getResponseCode() != BillingClient.BillingResponseCode.OK) {
                callback.onPurchase(null, messageOr(billingResult, "Could not read Google Play purchases."));
                return;
            }
            Purchase match = findPlan(purchases);
            if (match == null) {
                callback.onPurchase(null, null);
                return;
            }
            acknowledgeThen(match, () -> callback.onPurchase(match, null));
        });
    }

    private void resolveOwned(PluginCall call, boolean restored) {
        queryProduct(call, (product, error) -> queryPurchases(call, (purchase, purchaseError) -> {
            if (purchase == null) {
                call.reject("No Google Play subscription to restore for this account.");
                return;
            }
            call.resolve(offerPayload(product, purchase, restored));
        }));
    }

    private void finishPurchase(PluginCall call, Purchase purchase, boolean restored) {
        queryProduct(call, (product, error) -> call.resolve(offerPayload(product, purchase, restored)));
    }

    private void acknowledgeThen(Purchase purchase, Runnable next) {
        if (purchase.getPurchaseState() != Purchase.PurchaseState.PURCHASED || purchase.isAcknowledged()) {
            next.run();
            return;
        }
        AcknowledgePurchaseParams params = AcknowledgePurchaseParams.newBuilder()
            .setPurchaseToken(purchase.getPurchaseToken())
            .build();
        billingClient.acknowledgePurchase(params, billingResult -> next.run());
    }

    private void acknowledgeQuietly(List<Purchase> purchases) {
        Purchase match = findPlan(purchases);
        if (match != null) acknowledgeThen(match, () -> {});
    }

    private Purchase findPlan(List<Purchase> purchases) {
        if (purchases == null) return null;
        Purchase best = null;
        for (Purchase purchase : purchases) {
            List<String> products = purchase.getProducts();
            if (products == null || !products.contains(PRODUCT_ID)) continue;
            if (purchase.getPurchaseState() != Purchase.PurchaseState.PURCHASED) continue;
            if (best == null || purchase.getPurchaseTime() > best.getPurchaseTime()) best = purchase;
        }
        return best;
    }

    private ProductDetails.SubscriptionOfferDetails chooseOffer(ProductDetails product) {
        List<ProductDetails.SubscriptionOfferDetails> offers = product.getSubscriptionOfferDetails();
        if (offers == null || offers.isEmpty()) return null;
        ProductDetails.SubscriptionOfferDetails yearlyBase = null;
        ProductDetails.SubscriptionOfferDetails yearlyAny = null;
        for (ProductDetails.SubscriptionOfferDetails offer : offers) {
            if (!BASE_PLAN_ID.equals(offer.getBasePlanId())) continue;
            if (yearlyAny == null) yearlyAny = offer;
            if (OFFER_ID.equals(offer.getOfferId())) return offer;
            if (offer.getOfferId() == null && yearlyBase == null) yearlyBase = offer;
        }
        if (yearlyBase != null) return yearlyBase;
        if (yearlyAny != null) return yearlyAny;
        return offers.get(0);
    }

    private JSObject offerPayload(ProductDetails product, Purchase purchase, Boolean restored) {
        JSObject body = new JSObject();
        body.put("nativePlanIap", true);
        body.put("productId", PRODUCT_ID);
        body.put("displayName", "Tide Mark Plan");
        boolean entitled = purchase != null;
        body.put("entitled", entitled);
        body.put("status", entitled ? "active" : "none");
        if (product != null) {
            String name = product.getName();
            if (name != null && !name.isEmpty()) body.put("displayName", name);
            applyOffer(body, chooseOffer(product));
        }
        if (purchase != null) {
            String orderId = purchase.getOrderId();
            if (orderId != null && !orderId.isEmpty()) {
                body.put("transactionId", orderId);
                body.put("orderId", orderId);
            }
            body.put("purchaseToken", purchase.getPurchaseToken());
            body.put("originalTransactionId", purchase.getPurchaseToken());
        }
        if (restored != null) body.put("restored", restored);
        return body;
    }

    private void applyOffer(JSObject body, ProductDetails.SubscriptionOfferDetails offer) {
        if (offer == null) return;
        body.put("basePlanId", offer.getBasePlanId());
        if (offer.getOfferId() != null) body.put("offerId", offer.getOfferId());
        List<ProductDetails.PricingPhase> phases = offer.getPricingPhases().getPricingPhaseList();
        ProductDetails.PricingPhase intro = null;
        ProductDetails.PricingPhase paid = null;
        for (ProductDetails.PricingPhase phase : phases) {
            if (phase.getPriceAmountMicros() == 0 && intro == null) intro = phase;
            if (phase.getPriceAmountMicros() > 0) paid = phase;
        }
        if (paid != null) {
            body.put("displayPrice", paid.getFormattedPrice());
            putPeriod(body, "period", paid.getBillingPeriod());
        }
        if (intro != null) {
            body.put("introPaymentMode", "freeTrial");
            body.put("introDisplayPrice", intro.getFormattedPrice());
            putPeriod(body, "intro", intro.getBillingPeriod());
        }
    }

    private void putPeriod(JSObject body, String prefix, String iso) {
        Matcher matcher = iso == null ? null : PERIOD.matcher(iso);
        if (matcher == null || !matcher.matches()) return;
        String unit = switch (matcher.group(2)) {
            case "Y" -> "year";
            case "M" -> "month";
            case "W" -> "week";
            default -> "day";
        };
        int value = Integer.parseInt(matcher.group(1));
        if ("intro".equals(prefix)) {
            body.put("introPeriodUnit", unit);
            body.put("introPeriodValue", value);
        } else {
            body.put("periodUnit", unit);
            body.put("periodValue", value);
        }
    }

    private String messageOr(BillingResult result, String fallback) {
        String debug = result.getDebugMessage();
        if (debug != null && !debug.trim().isEmpty()) return debug;
        return fallback;
    }
}
