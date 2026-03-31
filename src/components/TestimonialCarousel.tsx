"use client";

import { useState, useEffect, useRef } from "react";

const INTERVAL_MS = 4000;
const FADE_MS = 400;

const testimonials = [
  {
    quote: "YourPeer NYC is the best. The info was useful, easy to understand and helped me find what I needed.",
    name: "Jorge C.",
  },
  {
    quote: "I found housing within two weeks of using YourPeer. The peer navigators really understood what I was going through.",
    name: "Maria S.",
  },
  {
    quote: "This app helped me connect with services I didn't even know existed. Complete game changer.",
    name: "Devon T.",
  },
  {
    quote: "The peer navigators made me feel less alone. They've been through similar experiences and that makes all the difference.",
    name: "Aisha M.",
  },
  {
    quote: "I got connected to a job training program through YourPeer. Now I have stable income and my own place.",
    name: "Carlos R.",
  },
];

export default function TestimonialCarousel() {
  const [active, setActive] = useState(0);
  const [visible, setVisible] = useState(true);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const goTo = (index: number) => {
    setVisible(false);
    setTimeout(() => {
      setActive(index);
      setVisible(true);
    }, FADE_MS);
  };

  useEffect(() => {
    timerRef.current = setInterval(() => {
      goTo((active + 1) % testimonials.length);
    }, INTERVAL_MS);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [active]);

  return (
    <section className="bg-white px-5 py-12 text-center">
      <div className="max-w-sm mx-auto">
        <div
          className={`min-h-[8rem] flex flex-col items-center justify-center transition-opacity duration-[400ms] ${visible ? "opacity-100" : "opacity-0"}`}
        >
          <blockquote className="text-brand-dark text-lg font-medium leading-snug">
            &ldquo;{testimonials[active].quote}&rdquo;
          </blockquote>
          <p className="mt-4 text-sm text-gray-500">{testimonials[active].name}</p>
        </div>

        {/* Dots */}
        <div className="flex items-center justify-center gap-2 mt-6">
          {testimonials.map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setActive(i)}
              aria-label={`Go to testimonial ${i + 1}`}
              className={`w-2 h-2 rounded-full transition-colors ${
                i === active ? "bg-brand-dark" : "bg-brand-grey"
              }`}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
