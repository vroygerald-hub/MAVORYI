(function () {
    var cartStorageKey = "mavoryi-cart";
    var whatsappNumber = "233549181995";

    function getCart() {
        try {
            var cart = JSON.parse(localStorage.getItem(cartStorageKey) || "[]");
            return Array.isArray(cart) ? cart : [];
        } catch (error) {
            return [];
        }
    }

    function updateCartBadge(count) {
        document.querySelectorAll(".cart-count").forEach(function (badge) {
            badge.textContent = String(count);
        });
    }

    function getOrderDetails(form) {
        var formData = new FormData(form);
        var products = window.MAVORYI_PRODUCTS || [];
        var cart = getCart();
        var items = cart.map(function (item) {
            var product = products.find(function (entry) { return entry.id === item.id; });
            if (!product || Number(item.quantity) < 1) {
                return null;
            }
            var variant = (product.variants || []).find(function (entry) {
                return entry.color === item.color;
            });
            return {
                product_id: product.id,
                name: variant ? variant.name : product.name,
                color: item.color,
                quantity: Number(item.quantity),
                unit_price: product.price
            };
        }).filter(Boolean);
        var timing = document.querySelector('[name="payment-timing"]:checked');
        var payOnDelivery = timing && timing.value === "on-delivery";
        var paymentMethod = payOnDelivery
            ? "on-delivery"
            : document.querySelector('[name="payment-method"]').value;
        var amount = items.reduce(function (total, item) {
            return total + (Number(item.unit_price) || 0) * item.quantity;
        }, 0);
        var customer = {
            name: String(formData.get("customer-name") || "").trim(),
            phone: String(formData.get("customer-phone") || "").trim(),
            email: String(formData.get("customer-email") || "").trim(),
            address: String(formData.get("delivery-address") || "").trim(),
            city: String(formData.get("delivery-city") || "").trim()
        };

        return {
            items: items,
            customer: customer,
            paymentTiming: payOnDelivery ? "on_delivery" : "before_delivery",
            paymentMethod: payOnDelivery ? "on-delivery" : paymentMethod,
            deliveryFee: payOnDelivery ? null : 0,
            amount: payOnDelivery ? null : amount,
            currency: "GHS"
        };
    }

    function buildWhatsAppUrl(order) {
        var itemLines = order.items.map(function (item) {
            return item.name + " / " + item.color + " x " + item.quantity;
        });
        var lines = [
            "Hello MAVORYI, I would like to place an order.",
            "Name: " + order.customer.name,
            "Phone: " + order.customer.phone,
            "Email: " + (order.customer.email || "Not provided"),
            "Delivery address: " + order.customer.address,
            "City/area: " + order.customer.city,
            "Items:",
            itemLines.join("\n"),
            "Payment: " + (order.paymentTiming === "on_delivery" ? "On delivery" : order.paymentMethod),
            "Delivery: " + (order.paymentTiming === "on_delivery" ? "Fee to be confirmed" : "Free")
        ];
        return "https://wa.me/" + whatsappNumber + "?text=" + encodeURIComponent(lines.join("\n"));
    }

    function showFallback(status, link, order, message) {
        status.textContent = message;
        link.href = buildWhatsAppUrl(order);
        link.hidden = false;
    }

    function clearCartAfterOrder(form, status, submitButton) {
        localStorage.removeItem(cartStorageKey);
        updateCartBadge(0);
        document.querySelector("[data-cart-quantity]").textContent = "0";
        document.querySelector("[data-cart-items]").innerHTML = "<div class=\"cart-empty\"><h3>Order received</h3><p>We will contact you to confirm the order.</p></div>";
        document.querySelector("[data-payment-timing]").hidden = true;
        document.querySelector("[data-payment-options]").hidden = true;
        document.querySelector("[data-order-status]").textContent = status;
        form.reset();
        submitButton.disabled = true;
        submitButton.textContent = "Order submitted";
    }

    document.addEventListener("DOMContentLoaded", function () {
        var form = document.querySelector("[data-order-form]");
        if (!form) {
            return;
        }

        var status = document.querySelector("[data-order-status]");
        var submitButton = document.querySelector("[data-order-submit]");
        var fallbackLink = document.querySelector("[data-whatsapp-fallback]");

        form.addEventListener("submit", async function (event) {
            event.preventDefault();

            var order = getOrderDetails(form);
            if (order.items.length === 0) {
                status.textContent = "Your cart is empty.";
                return;
            }
            if (order.paymentTiming === "before_delivery") {
                submitButton.disabled = false;
                submitButton.textContent = "Submit order";
                showFallback(status, fallbackLink, order, "Automated prepayment is not available yet. Choose pay on delivery, or contact MAVORYI to arrange prepayment.");
                return;
            }

            submitButton.disabled = true;
            submitButton.textContent = "Submitting...";
            status.textContent = "";
            fallbackLink.hidden = true;

            var config = window.MAVORYI_SUPABASE_CONFIG || {};
            var supabaseLibrary = window.supabase;
            var configured = config.url && config.anonKey && supabaseLibrary && supabaseLibrary.createClient;

            if (!configured) {
                submitButton.disabled = false;
                submitButton.textContent = "Submit order";
                showFallback(status, fallbackLink, order, "Online order storage is not configured yet. You can send your order to MAVORYI on WhatsApp instead.");
                return;
            }

            try {
                var client = supabaseLibrary.createClient(config.url, config.anonKey);
                var result = await client.from("orders").insert({
                    customer_name: order.customer.name,
                    customer_phone: order.customer.phone,
                    customer_email: order.customer.email || null,
                    delivery_address: order.customer.address,
                    delivery_city: order.customer.city,
                    payment_timing: order.paymentTiming,
                    payment_method: order.paymentMethod,
                    payment_status: "unpaid",
                    payment_provider: null,
                    payment_reference: null,
                    delivery_fee: order.deliveryFee,
                    amount: order.amount,
                    currency: order.currency,
                    items: order.items
                });

                if (result.error) {
                    throw result.error;
                }

                if (order.paymentTiming === "on_delivery") {
                    clearCartAfterOrder(form, "Order submitted successfully. Payment is due on delivery and MAVORYI will confirm the delivery fee.", submitButton);
                    return;
                }

            } catch (error) {
                submitButton.disabled = false;
                submitButton.textContent = "Submit order";
                showFallback(status, fallbackLink, order, "We could not save this order online. Please use WhatsApp to send it to MAVORYI.");
            }
        });
    });
})();
