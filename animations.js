document.addEventListener("DOMContentLoaded", () => {

    const tl = gsap.timeline({ defaults: { ease: "power2.out", duration: 0.6 } });


    tl.from(".hero, h1", { opacity: 0, y: 20 })
        .from(".hero p, .hero-subtitle", { opacity: 0, y: 15 }, "-=0.3")


        .to(".navbar-brand, .fa-square-poll-vertical", {
            y: -4,
            duration: 1.5,
            repeat: -1,
            yoyo: true,
            ease: "sine.inOut"
        }, "-=0.2");


    document.querySelectorAll(".btn, .poll-option-btn").forEach(btn => {
        btn.addEventListener("mouseenter", () => gsap.to(btn, { scale: 1.03, duration: 0.2 }));
        btn.addEventListener("mouseleave", () => gsap.to(btn, { scale: 1, duration: 0.2 }));
    });
});


function animatePollCards() {
    gsap.from(".poll-card", {
        opacity: 0,
        y: 20,
        duration: 0.4,
        stagger: 0.1,
        ease: "power1.out"
    });
}


function animateModal(modalEl) {
    gsap.from(modalEl, {
        opacity: 0,
        scale: 0.85,
        duration: 0.3,
        ease: "back.out(1.4)"
    });
}