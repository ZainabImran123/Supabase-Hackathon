document.addEventListener("DOMContentLoaded", () => {
    const tl = gsap.timeline({ defaults: { ease: "power2.out", duration: 0.6 } });

    tl.from("nav", { opacity: 0, y: -20, duration: 0.5 })

        .from("#userName", { opacity: 0, scale: 0.9, duration: 0.5 }, "-=0.2")
        .from("main h1 + p", { opacity: 0, y: 10, duration: 0.4 }, "-=0.3")

        .to("nav .text-cyan-400", {
            y: -3,
            duration: 1.8,
            repeat: -1,
            yoyo: true,
            ease: "sine.inOut"
        }, "-=0.2");

    const interactiveButtons = document.querySelectorAll(
        "button, #createEventBtn, #createPollBtn, #findPartnerBtn, #createPostBtn"
    );

    interactiveButtons.forEach(btn => {
        btn.addEventListener("mouseenter", () => {
            gsap.to(btn, { scale: 1.03, duration: 0.2, ease: "power1.out" });
        });
        btn.addEventListener("mouseleave", () => {
            gsap.to(btn, { scale: 1, duration: 0.2, ease: "power1.out" });
        });
    });
});

function animatePostCards() {
    const posts = document.querySelectorAll("#postsContainer > div");
    if (posts.length > 0) {
        gsap.from(posts, {
            opacity: 0,
            y: 20,
            duration: 0.4,
            stagger: 0.08,
            ease: "power1.out"
        });
    }
}

function animateModal(modalEl) {
    if (modalEl) {
        gsap.from(modalEl, {
            opacity: 0,
            scale: 0.85,
            duration: 0.3,
            ease: "back.out(1.4)"
        });
    }
}