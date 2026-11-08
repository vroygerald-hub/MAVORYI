(function () {
    function initializeSlider(slider) {
        if (slider.dataset.sliderInitialized === "true") {
            slider.mavoryiShowSlide(0);
            return;
        }

        var track = slider.querySelector(".slides");
        var slides = Array.from(slider.querySelectorAll(".slide"));
        var dots = slider.querySelector(".slider-dots");
        var previousButton = slider.querySelector(".slider-btn.prev");
        var nextButton = slider.querySelector(".slider-btn.next");
        var activeIndex = 0;
        var startX = 0;

        if (!track || slides.length === 0) {
            return;
        }

        function showSlide(index) {
            activeIndex = (index + slides.length) % slides.length;
            track.style.transform = "translateX(-" + (activeIndex * 100) + "%)";

            if (dots) {
                Array.from(dots.children).forEach(function (dot, dotIndex) {
                    var isActive = dotIndex === activeIndex;
                    dot.classList.toggle("active", isActive);
                    dot.setAttribute("aria-pressed", String(isActive));
                });
            }
        }

        if (dots) {
            dots.replaceChildren();
            slides.forEach(function (_, index) {
                var dot = document.createElement("button");
                dot.type = "button";
                dot.setAttribute("aria-label", "Show product image " + (index + 1));
                dot.addEventListener("click", function () {
                    showSlide(index);
                });
                dots.appendChild(dot);
            });
        }

        if (previousButton) {
            previousButton.addEventListener("click", function () {
                showSlide(activeIndex - 1);
            });
        }

        if (nextButton) {
            nextButton.addEventListener("click", function () {
                showSlide(activeIndex + 1);
            });
        }

        slider.addEventListener("touchstart", function (event) {
            startX = event.changedTouches[0].clientX;
        }, { passive: true });

        slider.addEventListener("touchend", function (event) {
            var distance = event.changedTouches[0].clientX - startX;
            if (Math.abs(distance) > 40) {
                showSlide(activeIndex + (distance < 0 ? 1 : -1));
            }
        }, { passive: true });

        slider.mavoryiShowSlide = showSlide;
        slider.dataset.sliderInitialized = "true";
        showSlide(0);
    }

    window.MAVORYI_REFRESH_SLIDERS = function () {
        document.querySelectorAll("[data-slider]").forEach(initializeSlider);
    };

    document.addEventListener("DOMContentLoaded", window.MAVORYI_REFRESH_SLIDERS);
})();
