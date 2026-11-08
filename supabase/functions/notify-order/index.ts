function jsonResponse(status: number, message: string): Response {
    return new Response(JSON.stringify({ message }), {
        status,
        headers: { "Content-Type": "application/json" }
    });
}

function constantTimeEquals(left: string, right: string): boolean {
    const encoder = new TextEncoder();
    const leftBytes = encoder.encode(left);
    const rightBytes = encoder.encode(right);
    if (leftBytes.length !== rightBytes.length) return false;

    let difference = 0;
    for (let index = 0; index < leftBytes.length; index += 1) {
        difference |= leftBytes[index] ^ rightBytes[index];
    }
    return difference === 0;
}

function escapeHtml(value: string): string {
    return value.replace(/[&<>"']/g, function (character) {
        const entities: Record<string, string> = {
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            "\"": "&quot;",
            "'": "&#39;"
        };
        return entities[character];
    });
}

async function sendEmail(apiKey: string, idempotencyKey: string, message: Record<string, unknown>): Promise<Response> {
    return await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
            Authorization: "Bearer " + apiKey,
            "Content-Type": "application/json",
            "Idempotency-Key": idempotencyKey
        },
        body: JSON.stringify(message)
    });
}

Deno.serve(async (request: Request) => {
    if (request.method !== "POST") {
        return jsonResponse(405, "Method not allowed");
    }

    const webhookSecret = Deno.env.get("ORDER_WEBHOOK_SECRET") || "";
    const suppliedSecret = request.headers.get("x-order-webhook-secret") || "";
    if (!webhookSecret || !constantTimeEquals(suppliedSecret, webhookSecret)) {
        return jsonResponse(401, "Unauthorized");
    }

    type OrderRecord = {
        id?: string;
        status?: string;
        customer_name?: string;
        customer_email?: string | null;
    };
    let payload: {
        type?: string;
        schema?: string;
        table?: string;
        record?: OrderRecord;
        old_record?: OrderRecord;
    };

    try {
        payload = await request.json();
    } catch {
        return jsonResponse(400, "Invalid JSON");
    }

    if ((payload.type !== "INSERT" && payload.type !== "UPDATE") || payload.schema !== "public" || payload.table !== "orders") {
        return jsonResponse(400, "Unexpected database event");
    }

    const orderId = payload.record?.id || "";
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(orderId)) {
        return jsonResponse(400, "Invalid order reference");
    }

    if (payload.type === "UPDATE" && (
        payload.record?.status !== "confirmed" || payload.old_record?.status === "confirmed"
    )) {
        return jsonResponse(200, "No customer confirmation email needed");
    }

    const apiKey = Deno.env.get("RESEND_API_KEY");
    const fromEmail = Deno.env.get("ORDERS_FROM_EMAIL");
    if (!apiKey || !fromEmail) {
        return jsonResponse(500, "Email notification is not configured");
    }

    let emailResponse: Response;
    if (payload.type === "INSERT") {
        const adminEmail = Deno.env.get("ADMIN_EMAIL");
        const siteUrl = Deno.env.get("SITE_URL");
        if (!adminEmail || !siteUrl) {
            return jsonResponse(500, "Admin email notification is not configured");
        }

        let dashboardUrl: string;
        try {
            const baseUrl = new URL(siteUrl);
            if (baseUrl.protocol !== "https:") {
                return jsonResponse(500, "SITE_URL must use HTTPS");
            }
            dashboardUrl = new URL("admin.html", baseUrl).toString();
        } catch {
            return jsonResponse(500, "Invalid SITE_URL");
        }

        emailResponse = await sendEmail(apiKey, "mavoryi-new-order-" + orderId, {
            from: fromEmail,
            to: [adminEmail],
            subject: "New MAVORYI order " + orderId.slice(0, 8),
            text: "A new customer order has been received.\n\nOrder reference: " + orderId + "\nOpen the admin dashboard: " + dashboardUrl,
            html: "<p>A new customer order has been received.</p><p>Order reference: <strong>" + orderId + "</strong></p><p><a href=\"" + dashboardUrl + "\">Open the admin dashboard</a></p>"
        });
    } else {
        const customerEmail = payload.record?.customer_email;
        if (!customerEmail) {
            return jsonResponse(200, "Customer email is missing");
        }
        const customerName = payload.record?.customer_name || "there";
        const safeCustomerName = escapeHtml(customerName);
        const reference = orderId.slice(0, 8);
        emailResponse = await sendEmail(apiKey, "mavoryi-order-confirmed-" + orderId, {
            from: fromEmail,
            to: [customerEmail],
            subject: "MAVORYI has confirmed your order " + reference,
            text: "Hello " + customerName + ",\n\nMAVORYI has received and confirmed your order. Your order reference is " + reference + ". We will contact you with any delivery updates.",
            html: "<p>Hello " + safeCustomerName + ",</p><p>MAVORYI has received and confirmed your order.</p><p>Your order reference is <strong>" + reference + "</strong>.</p><p>We will contact you with any delivery updates.</p>"
        });
    }

    if (!emailResponse.ok) {
        return jsonResponse(502, "Email provider rejected the notification");
    }

    return jsonResponse(200, payload.type === "INSERT" ? "Admin email notification sent" : "Customer confirmation email sent");
});
