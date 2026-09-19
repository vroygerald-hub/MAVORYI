(function () {
    const CONTACT_EMAIL = "casadimavoryi@gmail.com";
    const WHATSAPP_NUMBER = "233549181995";
    const WHATSAPP_LABEL = "https://wa.me/233549181995";
    var contactDetails = {
        email: CONTACT_EMAIL,
        whatsappNumber: WHATSAPP_NUMBER,
        whatsappLabel: WHATSAPP_LABEL
    };
    var savedTheme = localStorage.getItem("mavoryi-theme");
    var theme = savedTheme === "light" ? "light" : "dark";

    document.documentElement.setAttribute("data-theme", theme);

    document.addEventListener("DOMContentLoaded", function () {
        var themeToggle = document.querySelector(".theme-toggle");
        var contactForm = document.querySelector(".contact-form");
        var emailLink = document.querySelector("#email-link");
        var hoverBoxes = document.querySelectorAll(".product-card, .info-panel");
        var collectionCards = document.querySelectorAll(".collections-page .product-card");
        var isTouchLayout = window.matchMedia("(hover: none) and (max-width: 768px)").matches;

        collectionCards.forEach(function (card) {
            card.addEventListener("click", function () {
                if (!isTouchLayout) {
                    return;
                }

                var shouldShow = !card.classList.contains("label-visible");

                collectionCards.forEach(function (otherCard) {
                    otherCard.classList.remove("label-visible");
                });

                if (shouldShow) {
                    card.classList.add("label-visible");
                }
            });
        });

        if (emailLink) {
            emailLink.href = "https://mail.google.com/mail/?view=cm&fs=1&to=" + encodeURIComponent(contactDetails.email);
            emailLink.target = "_blank";
            emailLink.rel = "noopener";
        }

        if (isTouchLayout) {
            hoverBoxes.forEach(function (hoverBox) {
                hoverBox.addEventListener("click", function () {
                    var shouldShow = !hoverBox.classList.contains("touch-active");

                    hoverBoxes.forEach(function (otherBox) {
                        otherBox.classList.remove("touch-active");
                    });

                    if (shouldShow) {
                        hoverBox.classList.add("touch-active");
                    }
                });
            });
        }

        if (contactForm && emailLink) {
            var nameInput = contactForm.querySelector('input[name="name"]');
            var messageInput = contactForm.querySelector('textarea[name="message"], input[name="message"]');

            function updateEmailLink() {
                var name = nameInput ? nameInput.value : "";
                var userMessage = messageInput ? messageInput.value : "";
                var subject = "Message from " + name + " - MAVORYI";
                var body = userMessage + "\n\nFrom: " + name;
                var gmailUrl = "https://mail.google.com/mail/?view=cm&fs=1&to=" + encodeURIComponent(contactDetails.email) + "&su=" + encodeURIComponent(subject) + "&body=" + encodeURIComponent(body);
                emailLink.href = gmailUrl;
            }

            if (nameInput) nameInput.addEventListener("input", updateEmailLink);
            if (messageInput) messageInput.addEventListener("input", updateEmailLink);
        }

        if (contactForm) {
            contactForm.addEventListener("submit", function (event) {
                event.preventDefault();
                var formData = new FormData(contactForm);
                var name = (formData.get("name") || "").toString().trim();
                var userMessage = (formData.get("message") || "").toString().trim();

                if (!name || !userMessage) {
                    alert("Please fill in your name and message before sending.");
                    return;
                }

                var message = userMessage + "\n\nFrom: " + name;
                var encodedMessage = encodeURIComponent(message);

                var appUrl = "whatsapp://send?phone=" + contactDetails.whatsappNumber + "&text=" + encodedMessage;
                var webUrl = "https://wa.me/" + contactDetails.whatsappNumber + "?text=" + encodedMessage;

                var appOpened = false;

                function handleVisibilityChange() {
                    if (document.hidden) {
                        appOpened = true;
                    }
                }

                document.addEventListener("visibilitychange", handleVisibilityChange);
                window.addEventListener("blur", handleVisibilityChange);

                window.location.href = appUrl;

                setTimeout(function () {
                    document.removeEventListener("visibilitychange", handleVisibilityChange);
                    window.removeEventListener("blur", handleVisibilityChange);
                    if (!appOpened) {
                        window.open(webUrl, "_blank");
                    }
                }, 1500);
            });
        }

        if (window.location.protocol !== "file:") {
            fetch("contact.json")
                .then(function (response) {
                    return response.json();
                })
                .then(function (details) {
                    contactDetails = details;
                    if (emailLink) {
                        emailLink.href = "https://mail.google.com/mail/?view=cm&fs=1&to=" + encodeURIComponent(contactDetails.email);
                    }
                })
                .catch(function () {
                    // contact.json not found or invalid — keep hardcoded defaults
                });
        }

        if (!themeToggle) {
            return;
        }

        function updateThemeButton() {
            var isLight = document.documentElement.getAttribute("data-theme") === "light";
            themeToggle.textContent = isLight ? "\u2600" : "\u263E";
            themeToggle.setAttribute("aria-label", isLight ? "Switch to dark mode" : "Switch to light mode");
            themeToggle.setAttribute("title", isLight ? "Switch to dark mode" : "Switch to light mode");
            themeToggle.setAttribute("aria-pressed", isLight ? "true" : "false");
        }

        updateThemeButton();

        themeToggle.addEventListener("click", function () {
            var nextTheme = document.documentElement.getAttribute("data-theme") === "light" ? "dark" : "light";
            document.documentElement.setAttribute("data-theme", nextTheme);
            localStorage.setItem("mavoryi-theme", nextTheme);
            updateThemeButton();
        });
    });
})();