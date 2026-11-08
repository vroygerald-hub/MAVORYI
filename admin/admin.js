(function () {
    var allowedStatuses = [
        ["new", "New"],
        ["confirmed", "Confirmed"],
        ["preparing", "Preparing"],
        ["out_for_delivery", "Out for delivery"],
        ["delivered", "Delivered"],
        ["cancelled", "Cancelled"]
    ];
    var client;
    var realtimeChannel;

    function setMessage(element, message) {
        element.textContent = message || "";
    }

    function showPanel(isAdmin) {
        document.querySelector("[data-admin-login-panel]").hidden = isAdmin;
        document.querySelector("[data-admin-dashboard]").hidden = !isAdmin;
    }

    function makeText(tag, className, text) {
        var element = document.createElement(tag);
        if (className) element.className = className;
        element.textContent = text;
        return element;
    }

    function makeOrderCard(order) {
        var card = document.createElement("article");
        card.className = "admin-order";

        var top = document.createElement("div");
        top.className = "admin-order-top";
        var created = new Date(order.created_at);
        top.appendChild(makeText("p", "admin-order-date", created.toLocaleString()));

        var statusControl = document.createElement("div");
        statusControl.className = "admin-status-control";
        var statusSelect = document.createElement("select");
        statusSelect.setAttribute("aria-label", "Order status");
        allowedStatuses.forEach(function (status) {
            var option = document.createElement("option");
            option.value = status[0];
            option.textContent = status[1];
            option.selected = order.status === status[0];
            statusSelect.appendChild(option);
        });
        var saveButton = makeText("button", "admin-button", "Update status");
        saveButton.type = "button";
        function updateStatusButtonLabel() {
            saveButton.textContent = statusSelect.value === "confirmed" && order.status !== "confirmed"
                ? "Confirm order"
                : "Update status";
        }
        statusSelect.addEventListener("change", updateStatusButtonLabel);
        updateStatusButtonLabel();
        saveButton.addEventListener("click", function () {
            updateOrderStatus(order.id, statusSelect.value, saveButton);
        });
        statusControl.appendChild(statusSelect);
        statusControl.appendChild(saveButton);
        top.appendChild(statusControl);
        card.appendChild(top);

        card.appendChild(makeText("h3", "admin-customer-name", order.customer_name));
        card.appendChild(makeText("p", "admin-customer-contact", "Phone: " + order.customer_phone));
        if (order.customer_email) {
            card.appendChild(makeText("p", "admin-customer-contact", "Email: " + order.customer_email));
        }
        card.appendChild(makeText("p", "admin-customer-address", order.delivery_address + ", " + order.delivery_city));

        var paymentMethodLabels = {
            "mtn-momo": "MTN Mobile Money",
            "momo": "Mobile Money",
            "telecel-cash": "Telecel Cash",
            "access-bank": "Access Bank",
            "on-delivery": "Pay on delivery",
            "legacy-online": "Online payment (legacy)"
        };
        var paymentMethod = paymentMethodLabels[order.payment_method] || order.payment_method;
        var payment = order.payment_timing === "on_delivery"
            ? paymentMethod + "; fee " + (order.delivery_fee === null ? "to be confirmed" : order.delivery_fee) + "; " + (order.payment_status || "unpaid")
            : "Pay before delivery; free delivery; " + paymentMethod + "; " + (order.payment_status || "unpaid") + (order.payment_reference ? "; ref " + order.payment_reference : "");
        card.appendChild(makeText("p", "admin-order-payment", payment));
        if (order.amount !== null && order.amount !== undefined) {
            card.appendChild(makeText("p", "admin-order-payment", "Order total: " + order.currency + " " + Number(order.amount).toFixed(2)));
        }

        var items = document.createElement("ul");
        items.className = "admin-order-items";
        (Array.isArray(order.items) ? order.items : []).forEach(function (item) {
            items.appendChild(makeText("li", "", item.name + " / " + item.color + " x " + item.quantity));
        });
        card.appendChild(items);
        card.appendChild(makeText("p", "admin-order-reference", "Order " + order.id));
        return card;
    }

    function makeProductEditor(product) {
        var row = document.createElement("div");
        row.className = "admin-product";

        row.appendChild(makeText("strong", "admin-product-name", product.name));
        var details = makeText("span", "admin-product-details", product.category);
        row.appendChild(details);

        var label = document.createElement("label");
        label.className = "admin-product-price-label";
        label.appendChild(document.createTextNode("GHS"));
        var input = document.createElement("input");
        input.type = "number";
        input.min = "0.01";
        input.step = "0.01";
        input.inputMode = "decimal";
        input.value = product.price === null || product.price === undefined ? "" : String(product.price);
        label.appendChild(input);
        row.appendChild(label);

        var saveButton = makeText("button", "admin-button", "Save price");
        saveButton.type = "button";
        saveButton.addEventListener("click", function () {
            saveProductPrice(product.id, input.value, saveButton);
        });
        row.appendChild(saveButton);
        return row;
    }

    async function saveProductPrice(productId, price, button) {
        var normalized = String(price).trim();
        var value = normalized === "" ? null : Number(normalized);
        if (value !== null && (!Number.isFinite(value) || value <= 0)) {
            setMessage(document.querySelector("[data-admin-dashboard-message]"), "Enter a valid price greater than zero, or leave it blank.");
            return;
        }

        button.disabled = true;
        var result = await client.from("products").update({
            price: value,
            updated_at: new Date().toISOString()
        }).eq("id", productId);
        button.disabled = false;
        if (result.error) {
            setMessage(document.querySelector("[data-admin-dashboard-message]"), "Could not save product price.");
            return;
        }
        setMessage(document.querySelector("[data-admin-dashboard-message]"), "Product price updated. The storefront will use it on its next refresh.");
    }

    async function loadProducts() {
        var list = document.querySelector("[data-admin-products]");
        list.replaceChildren();
        var result = await client
            .from("products")
            .select("id, name, category, price")
            .order("position", { ascending: true });
        if (result.error) {
            list.appendChild(makeText("p", "admin-message", "Could not load products."));
            return;
        }
        result.data.forEach(function (product) {
            list.appendChild(makeProductEditor(product));
        });
    }

    async function loadOrders() {
        var message = document.querySelector("[data-admin-dashboard-message]");
        var list = document.querySelector("[data-admin-orders]");
        setMessage(message, "Loading orders...");
        list.replaceChildren();

        var result = await client
            .from("orders")
            .select("id, customer_name, customer_phone, customer_email, delivery_address, delivery_city, payment_timing, payment_method, delivery_fee, amount, currency, payment_status, payment_reference, items, status, created_at")
            .order("created_at", { ascending: false });

        if (result.error) {
            setMessage(message, "Could not load orders. Check the Supabase table and admin access policies.");
            return;
        }

        if (!result.data.length) {
            setMessage(message, "No customer orders yet.");
            return;
        }

        setMessage(message, result.data.length + " order" + (result.data.length === 1 ? "" : "s"));
        result.data.forEach(function (order) {
            list.appendChild(makeOrderCard(order));
        });
    }

    function startLiveUpdates() {
        if (realtimeChannel) {
            client.removeChannel(realtimeChannel);
        }

        var connectionStatus = document.querySelector("[data-admin-live-status]");
        var notification = document.querySelector("[data-admin-new-order]");
        var notificationMessage = document.querySelector("[data-admin-new-order-message]");

        setMessage(connectionStatus, "Connecting to live order updates...");
        realtimeChannel = client
            .channel("mavoryi-admin-orders")
            .on("postgres_changes", {
                event: "INSERT",
                schema: "public",
                table: "orders"
            }, function () {
                notificationMessage.textContent = "New order received. The order list has been refreshed.";
                notification.hidden = false;
                loadOrders();
            })
            .subscribe(function (status) {
                if (status === "SUBSCRIBED") {
                    setMessage(connectionStatus, "Live order updates connected.");
                } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
                    setMessage(connectionStatus, "Live updates unavailable. Use Refresh to check orders.");
                }
            });
    }

    function stopLiveUpdates() {
        if (realtimeChannel && client) {
            client.removeChannel(realtimeChannel);
            realtimeChannel = null;
        }
    }

    async function updateOrderStatus(orderId, status, button) {
        button.disabled = true;
        var result = await client.from("orders").update({ status: status }).eq("id", orderId);
        button.disabled = false;
        if (result.error) {
            setMessage(document.querySelector("[data-admin-dashboard-message]"), "Status update failed. Verify admin update permissions.");
            return;
        }
        setMessage(document.querySelector("[data-admin-dashboard-message]"), "Order status updated.");
    }

    async function acceptAdminSession(user) {
        if (!user || !user.app_metadata || user.app_metadata.role !== "admin") {
            stopLiveUpdates();
            if (user) await client.auth.signOut();
            showPanel(false);
            setMessage(document.querySelector("[data-admin-login-message]"), "This account is not authorized to access orders.");
            return false;
        }

        showPanel(true);
        await loadProducts();
        await loadOrders();
        startLiveUpdates();
        return true;
    }

    document.addEventListener("DOMContentLoaded", async function () {
        var config = window.MAVORYI_SUPABASE_CONFIG || {};
        var library = window.supabase;
        var loginForm = document.querySelector("[data-admin-login]");
        var loginMessage = document.querySelector("[data-admin-login-message]");
        var loginButton = document.querySelector("[data-admin-login-button]");

        if (!config.url || !config.anonKey || !library || !library.createClient) {
            setMessage(loginMessage, "Admin access is not configured. Follow SUPABASE_SETUP.md before signing in.");
            return;
        }

        client = library.createClient(config.url, config.anonKey);
        showPanel(false);

        var sessionResult = await client.auth.getSession();
        if (sessionResult.data.session) {
            await acceptAdminSession(sessionResult.data.session.user);
        }

        loginForm.addEventListener("submit", async function (event) {
            event.preventDefault();
            loginButton.disabled = true;
            setMessage(loginMessage, "Signing in...");
            var formData = new FormData(loginForm);
            var result = await client.auth.signInWithPassword({
                email: String(formData.get("email")).trim(),
                password: String(formData.get("password"))
            });
            loginButton.disabled = false;

            if (result.error) {
                setMessage(loginMessage, "Sign-in failed. Check the account details and try again.");
                return;
            }

            setMessage(loginMessage, "");
            await acceptAdminSession(result.data.user);
        });

        document.querySelector("[data-admin-refresh]").addEventListener("click", function () {
            loadProducts();
            loadOrders();
        });
        document.querySelector("[data-admin-dismiss-notification]").addEventListener("click", function () {
            document.querySelector("[data-admin-new-order]").hidden = true;
        });
        document.querySelector("[data-admin-logout]").addEventListener("click", async function () {
            stopLiveUpdates();
            await client.auth.signOut();
            showPanel(false);
            setMessage(loginMessage, "You have signed out.");
        });
    });
})();
