/* ==========================================================
   PILLARS COFFEE V2
========================================================== */

/* ------------------------------
   Mobile Navigation
------------------------------ */

const menuToggle = document.querySelector(".menu-toggle");
const navLinks = document.querySelector(".nav-links");

if (menuToggle && navLinks) {

    menuToggle.addEventListener("click", () => {

        navLinks.classList.toggle("active");

    });

    navLinks.querySelectorAll("a").forEach(link => {

        link.addEventListener("click", () => {

            navLinks.classList.remove("active");

        });

    });

}

/* ------------------------------
   Sticky Header
------------------------------ */

const header = document.querySelector("header");

window.addEventListener("scroll", () => {

    if (window.scrollY > 30) {

        header.classList.add("scrolled");

    } else {

        header.classList.remove("scrolled");

    }

});

/* ------------------------------
   Fade In Animation
------------------------------ */

const revealElements = document.querySelectorAll(".reveal");

const observer = new IntersectionObserver((entries) => {

    entries.forEach(entry => {

        if (entry.isIntersecting) {

            entry.target.classList.add("visible");

        }

    });

}, {
    threshold: 0.15
});

revealElements.forEach(el => observer.observe(el));

/* ------------------------------
   Smooth Scroll
------------------------------ */

document.querySelectorAll('a[href^="#"]').forEach(anchor => {

    anchor.addEventListener("click", function(e) {

        const target = document.querySelector(this.getAttribute("href"));

        if (!target) return;

        e.preventDefault();

        target.scrollIntoView({

            behavior: "smooth"

        });

    });

});

/* ------------------------------
   Button Hover Lift
------------------------------ */

document.querySelectorAll(".button").forEach(button => {

    button.addEventListener("mouseenter", () => {

        button.style.transform = "translateY(-3px)";

    });

    button.addEventListener("mouseleave", () => {

        button.style.transform = "";

    });

});

/* ------------------------------
   Image Fade In
------------------------------ */

document.querySelectorAll("img").forEach(img => {

    if (img.complete) {

        img.classList.add("loaded");

    } else {

        img.onload = () => {

            img.classList.add("loaded");

        };

    }

});

console.log("☕ Pillars Coffee V2 Loaded");
