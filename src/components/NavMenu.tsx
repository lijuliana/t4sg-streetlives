"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { X } from "lucide-react";

const menuSections = [
  {
    heading: "Explore Services",
    links: ["Find Services Nearby", "Browse all Services"],
  },
  {
    heading: "Resources",
    links: ["Articles", "Events and webinars", "Glossary of terms"],
  },
  {
    heading: "About",
    links: ["About this Website", "Careers", "Partners", "FAQ"],
  },
];

export default function NavMenu() {
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* Hamburger button */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="p-1 text-brand-dark hover:opacity-70 transition-opacity"
        aria-label="Open menu"
      >
        <Image src="/new-icons/menu.svg" alt="" width={22} height={22} aria-hidden />
      </button>

      {/* Full-screen overlay */}
      {open && (
        <div className="fixed inset-0 z-50 bg-brand-dark overflow-y-auto">
          {/* Overlay header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="p-1 text-white hover:opacity-70 transition-opacity"
              aria-label="Close menu"
            >
              <X size={22} strokeWidth={2} />
            </button>

            <Link
              href="/"
              onClick={() => setOpen(false)}
              className="text-base tracking-tight text-white"
            >
              <span className="font-bold">YourPeer</span>{" "}
              <span className="font-normal">NYC</span>
            </Link>

            <a
              href="https://www.google.com"
              className="flex items-center gap-1.5 text-brand-exit text-xs font-medium uppercase tracking-wide"
              aria-label="Quick exit — leave this site"
            >
              Quick Exit
              <span className="w-5 h-5 rounded-full bg-brand-exit text-white flex items-center justify-center text-xs font-medium leading-none">
                !
              </span>
            </a>
          </div>

          {/* Menu content */}
          <nav className="px-6 py-8 max-w-2xl mx-auto">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
              {/* Explore Services + Provider Portal */}
              <div className="space-y-8">
                <section>
                  <p className="text-white font-medium text-base mb-3">
                    Explore Services
                  </p>
                  <ul className="space-y-3">
                    <li>
                      <Link href="#" onClick={() => setOpen(false)} className="text-white underline text-sm hover:opacity-70 transition-opacity">
                        Find Services Nearby
                      </Link>
                    </li>
                    <li>
                      <Link href="#" onClick={() => setOpen(false)} className="text-white underline text-sm hover:opacity-70 transition-opacity">
                        Browse all Services
                      </Link>
                    </li>
                  </ul>
                </section>

                <section>
                  <Link href="#" onClick={() => setOpen(false)} className="text-white underline font-medium text-base hover:opacity-70 transition-opacity">
                    Provider Portal
                  </Link>
                </section>
              </div>

              {/* Resources + About */}
              <div className="space-y-8">
                {menuSections.slice(1).map((section) => (
                  <section key={section.heading}>
                    <p className="text-white font-medium text-base mb-3">
                      {section.heading}
                    </p>
                    <ul className="space-y-3">
                      {section.links.map((link) => (
                        <li key={link}>
                          <Link href="#" onClick={() => setOpen(false)} className="text-white underline text-sm hover:opacity-70 transition-opacity">
                            {link}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </section>
                ))}
              </div>
            </div>
          </nav>
        </div>
      )}
    </>
  );
}
