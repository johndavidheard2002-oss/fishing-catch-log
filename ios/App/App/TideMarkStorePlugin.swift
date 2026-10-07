import Capacitor
import Foundation
import StoreKit

/// StoreKit 2 bridge for Tide Mark Plan (`com.tidemark.logbook.plan.monthly`).
/// `planOffer` exists only in the 2.0 binary. The 1.0 app does not implement it,
/// and its WebView user agent does not include TideMarkPlanIAP/2, so the remote
/// site keeps Plan free for that build.
@objc(TideMarkStorePlugin)
public class TideMarkStorePlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "TideMarkStorePlugin"
    public let jsName = "TideMarkStore"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "getProduct", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "planOffer", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "purchase", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "restore", returnType: CAPPluginReturnPromise),
    ]

    static let planProductId = "com.tidemark.logbook.plan.monthly"
    static let subscriptionGroup = "Tide Mark Plan"

    private let iso: ISO8601DateFormatter = {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime]
        return formatter
    }()

    @objc func getProduct(_ call: CAPPluginCall) {
        Task {
            do {
                let product = try await self.loadPlanProduct()
                call.resolve(self.productPayload(product))
            } catch {
                call.reject(error.localizedDescription)
            }
        }
    }

    /// Always resolves on 2.0, including when the App Store product is not loaded yet.
    @objc func planOffer(_ call: CAPPluginCall) {
        Task {
            await self.finishUnfinished()
            let product = try? await self.loadPlanProduct()
            let state = await self.readPlanState()
            call.resolve(self.offerPayload(product: product, state: state, restored: nil))
        }
    }

    @objc func purchase(_ call: CAPPluginCall) {
        Task {
            do {
                let product = try await self.loadPlanProduct()
                let result = try await product.purchase()
                switch result {
                case .success(let verification):
                    let transaction = try self.unwrap(verification)
                    await transaction.finish()
                    let state = self.state(from: transaction)
                    call.resolve(self.offerPayload(product: product, state: state, restored: true))
                case .userCancelled:
                    call.reject("Purchase cancelled.", "USER_CANCELLED")
                case .pending:
                    call.reject("Purchase is pending approval.", "PENDING")
                @unknown default:
                    call.reject("Purchase failed.")
                }
            } catch {
                call.reject(error.localizedDescription)
            }
        }
    }

    @objc func restore(_ call: CAPPluginCall) {
        Task {
            do {
                try await AppStore.sync()
                await self.finishUnfinished()
                let product = try? await self.loadPlanProduct()
                let state = await self.readPlanState()
                var body = self.offerPayload(product: product, state: state, restored: state.entitled)
                if !state.entitled {
                    body["restored"] = false
                }
                call.resolve(body)
            } catch {
                call.reject(error.localizedDescription)
            }
        }
    }

    private func loadPlanProduct() async throws -> Product {
        let products = try await Product.products(for: [Self.planProductId])
        guard let product = products.first(where: { $0.id == Self.planProductId }) else {
            throw StorePluginError.missingProduct
        }
        return product
    }

    private func finishUnfinished() async {
        for await result in Transaction.unfinished {
            if let transaction = try? self.unwrap(result), transaction.productID == Self.planProductId {
                await transaction.finish()
            }
        }
    }

    private struct PlanState {
        var entitled: Bool
        var status: String
        var expiresAt: String?
        var transactionId: String?
        var originalTransactionId: String?
        var jws: String?
    }

    /// Latest transaction, including an expired or revoked one, so relaunch can lock Plan again.
    private func readPlanState() async -> PlanState {
        guard let result = await Transaction.latest(for: Self.planProductId) else {
            return PlanState(entitled: false, status: "none", expiresAt: nil, transactionId: nil, originalTransactionId: nil, jws: nil)
        }
        guard let transaction = try? self.unwrap(result) else {
            return PlanState(entitled: false, status: "none", expiresAt: nil, transactionId: nil, originalTransactionId: nil, jws: nil)
        }
        return self.state(from: transaction)
    }

    private func state(from transaction: Transaction) -> PlanState {
        let expires = transaction.expirationDate
        let revoked = transaction.revocationDate != nil
        let expired = expires.map { $0 <= Date() } ?? false
        let entitled = transaction.productID == Self.planProductId && !revoked && !expired
        return PlanState(
            entitled: entitled,
            status: entitled ? "active" : "expired",
            expiresAt: expires.map { self.iso.string(from: $0) },
            transactionId: String(transaction.id),
            originalTransactionId: String(transaction.originalID),
            jws: transaction.jwsRepresentation
        )
    }

    private func unwrap<T>(_ result: VerificationResult<T>) throws -> T {
        switch result {
        case .verified(let value):
            return value
        case .unverified(_, let error):
            throw error
        }
    }

    private func productPayload(_ product: Product) -> [String: Any] {
        var body: [String: Any] = [
            "productId": product.id,
            "displayPrice": product.displayPrice,
            "displayName": product.displayName,
        ]
        if let subscription = product.subscription {
            body["periodUnit"] = Self.unitName(subscription.subscriptionPeriod.unit)
            body["periodValue"] = subscription.subscriptionPeriod.value
            if let intro = subscription.introductoryOffer {
                body["introPaymentMode"] = Self.paymentName(intro.paymentMode)
                body["introPeriodUnit"] = Self.unitName(intro.period.unit)
                body["introPeriodValue"] = intro.period.value
                body["introDisplayPrice"] = intro.displayPrice
            }
        }
        return body
    }

    private func offerPayload(product: Product?, state: PlanState, restored: Bool?) -> [String: Any] {
        var body: [String: Any] = [
            "nativePlanIap": true,
            "productId": Self.planProductId,
            "subscriptionGroup": Self.subscriptionGroup,
            "entitled": state.entitled,
            "status": state.status,
        ]
        if let product {
            let info = self.productPayload(product)
            for (key, value) in info {
                body[key] = value
            }
        }
        if let expires = state.expiresAt { body["expiresAt"] = expires }
        if let transactionId = state.transactionId { body["transactionId"] = transactionId }
        if let original = state.originalTransactionId { body["originalTransactionId"] = original }
        if let jws = state.jws { body["jws"] = jws }
        if let restored { body["restored"] = restored }
        return body
    }

    private static func unitName(_ unit: Product.SubscriptionPeriod.Unit) -> String {
        switch unit {
        case .day: return "day"
        case .week: return "week"
        case .month: return "month"
        case .year: return "year"
        @unknown default: return "month"
        }
    }

    private static func paymentName(_ mode: Product.SubscriptionOffer.PaymentMode) -> String {
        switch mode {
        case .freeTrial: return "freeTrial"
        case .payAsYouGo: return "payAsYouGo"
        case .payUpFront: return "payUpFront"
        @unknown default: return "unknown"
        }
    }
}

private enum StorePluginError: LocalizedError {
    case missingProduct

    var errorDescription: String? {
        switch self {
        case .missingProduct:
            return "App Store product com.tidemark.logbook.plan.monthly is not available."
        }
    }
}
