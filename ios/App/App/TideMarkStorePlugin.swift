import Capacitor
import Foundation
import StoreKit

/// StoreKit 2 bridge for Tide Mark Premium (`tidemark_premium_yearly`).
/// Real purchase sheets only run on a signed iOS device or Xcode StoreKit config.
@objc(TideMarkStorePlugin)
public class TideMarkStorePlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "TideMarkStorePlugin"
    public let jsName = "TideMarkStore"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "getProduct", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "purchase", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "restore", returnType: CAPPluginReturnPromise),
    ]

    private let yearlyProductId = "tidemark_premium_yearly"

    @objc func getProduct(_ call: CAPPluginCall) {
        Task {
            do {
                let product = try await self.loadYearlyProduct()
                call.resolve([
                    "productId": product.id,
                    "displayPrice": product.displayPrice,
                    "displayName": product.displayName,
                ])
            } catch {
                call.reject(error.localizedDescription)
            }
        }
    }

    @objc func purchase(_ call: CAPPluginCall) {
        Task {
            do {
                let product = try await self.loadYearlyProduct()
                let result = try await product.purchase()
                switch result {
                case .success(let verification):
                    let transaction = try self.unwrap(verification)
                    await transaction.finish()
                    call.resolve(self.payload(from: transaction, restored: true))
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
                for await result in Transaction.currentEntitlements {
                    let transaction = try self.unwrap(result)
                    if transaction.productID == self.yearlyProductId {
                        call.resolve(self.payload(from: transaction, restored: true))
                        return
                    }
                }
                call.resolve([
                    "productId": self.yearlyProductId,
                    "restored": false,
                ])
            } catch {
                call.reject(error.localizedDescription)
            }
        }
    }

    private func loadYearlyProduct() async throws -> Product {
        let products = try await Product.products(for: [yearlyProductId])
        guard let product = products.first(where: { $0.id == yearlyProductId }) else {
            throw StorePluginError.missingProduct
        }
        return product
    }

    private func unwrap<T>(_ result: VerificationResult<T>) throws -> T {
        switch result {
        case .verified(let value):
            return value
        case .unverified(_, let error):
            throw error
        }
    }

    private func payload(from transaction: Transaction, restored: Bool) -> [String: Any] {
        var body: [String: Any] = [
            "productId": transaction.productID,
            "transactionId": String(transaction.id),
            "originalTransactionId": String(transaction.originalID),
            "restored": restored,
        ]
        if let expires = transaction.expirationDate {
            body["expiresAt"] = ISO8601DateFormatter().string(from: expires)
        }
        return body
    }
}

private enum StorePluginError: LocalizedError {
    case missingProduct

    var errorDescription: String? {
        switch self {
        case .missingProduct:
            return "App Store product tidemark_premium_yearly is not available."
        }
    }
}
