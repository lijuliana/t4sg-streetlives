import Link from "next/link";
import Image from "next/image";
import Navbar from "@/components/Navbar";

const services = [
  { icon: "/icons/accommodations.svg", name: "Accommodations", description: "A place to stay, shelter, vouchers" },
  { icon: "/icons/food.svg",           name: "Food",           description: "Something to eat" },
  { icon: "/icons/clothing.svg",       name: "Clothing",       description: "Something to wear" },
  { icon: "/icons/personal-care.svg",  name: "Personal Care",  description: "Shower, restroom, laundry" },
  { icon: "/icons/health.svg",         name: "Health",         description: "Clinic, mental health, medicine" },
  { icon: "/icons/family.svg",         name: "Family Services",description: "Childcare, nursing, check-ups" },
  { icon: "/icons/work.svg",           name: "Work",           description: "Jobs, applications, training" },
  { icon: "/icons/legal.svg",          name: "Legal",          description: "Lawyers, court services, immigration" },
  { icon: "/icons/connection.svg",     name: "Connection",     description: "Wi-fi, mailbox, computer room" },
  { icon: "/icons/nearby.svg",         name: "Services Nearby",description: "Browse services on a map" },
  { icon: "/icons/help.svg",           name: "Need Help?",     description: "Use our chat assistant" },
];

export default function HomePage() {
  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />

      {/* Hero */}
      <section className="bg-brand-yellow px-5 pt-10 pb-12">
        <h1 className="text-3xl font-black leading-tight text-gray-900 max-w-xs">
          Peer-validated services for youth and young adults
        </h1>
        <p className="mt-3 text-sm text-gray-800 max-w-xs">
          Search through hundreds of free support services in NYC that are right
          for you.
        </p>
      </section>

      {/* Service Categories */}
      <section className="bg-white flex-1">
        <ul className="divide-y divide-gray-100">
          {services.map(({ icon, name, description }) => (
            <li key={name}>
              <button
                type="button"
                className="w-full flex items-center gap-4 px-5 py-4 hover:bg-gray-50 transition text-left"
              >
                <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
                  <Image src={icon} alt="" width={22} height={22} aria-hidden />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-900 text-sm">{name}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{description}</p>
                </div>
                <Image src="/icons/arrow-right.svg" alt="" width={18} height={18} className="text-gray-400 flex-shrink-0" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      </section>

      {/* "You're not alone" — yellow background, matches wireframe */}
      <section className="bg-brand-yellow px-5 pt-12 pb-10">
        <h2 className="text-2xl font-black text-gray-900 leading-snug max-w-xs">
          You&rsquo;re not alone in this journey
        </h2>
        <p className="mt-4 text-sm text-gray-800 max-w-sm leading-relaxed">
          People can experience homelessness for many reasons. Our peer
          navigators share lived experience with the system and help you prepare
          for the future.
        </p>
        {/* Peer illustration placeholder — honeycomb of faces */}
        {/* <div className="my-8 flex justify-center">
          <div className="grid grid-cols-3 gap-3 max-w-[180px]">
            {Array.from({ length: 9 }).map((_, i) => (
              <div
                key={i}
                className="w-14 h-14 rounded-full bg-white/60 border-2 border-white flex items-center justify-center text-xl"
              >
              </div>
            ))}
          </div>
        </div> */}
        <button
          type="button"
          className="bg-gray-900 text-white text-sm font-bold px-6 py-3 my-5 rounded-xl hover:bg-gray-800 transition"
        >
          Learn From Peers
        </button>
      </section>

      {/* Testimonial quote */}
      <section className="bg-gray-900 px-5 py-10">
        <p className="text-4xl font-black text-brand-yellow leading-none mb-4">&ldquo;</p>
        <blockquote className="text-white text-base font-semibold leading-relaxed max-w-sm">
          YourPeer NYC is the best. The info was useful, easy to understand and
          helped me find what I needed.
        </blockquote>
        <p className="mt-4 text-xs text-gray-400">— Jorge C.</p>
      </section>

      {/* Provider CTA */}
      <section className="bg-brand-dark px-5 py-10 text-center">
        <p className="text-white font-bold text-lg">
          Are you a service provider?
        </p>
        <p className="text-gray-400 text-sm mt-2 max-w-xs mx-auto">
          Our provider portal can help you keep info updated and find other
          providers for client referrals.
        </p>
        <Link
          href="#"
          className="mt-5 inline-block bg-brand-yellow text-gray-900 text-sm font-bold px-6 py-3 rounded-xl hover:brightness-95 transition"
        >
          Sign Up for Provider Portal
        </Link>
      </section>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-200 px-5 py-6">
        <div className="flex flex-wrap gap-x-6 gap-y-2 text-xs text-gray-500">
          <a href="#" className="hover:text-gray-900 transition">About</a>
          <a href="#" className="hover:text-gray-900 transition">Leave Feedback</a>
          <a href="#" className="hover:text-gray-900 transition">Privacy Policy</a>
          <a href="#" className="hover:text-gray-900 transition">Terms of Use</a>
        </div>
        <p className="mt-4 text-xs text-gray-400">© StreetLives.org</p>
      </footer>

      {/* Chat FAB */}
      <Link
        href="/chat"
        className="fixed bottom-20 right-5 w-14 h-14 bg-brand-yellow rounded-full shadow-lg flex items-center justify-center hover:brightness-95 transition z-50"
        aria-label="Chat with a peer navigator"
      >
        <Image src="/icons/chat.svg" alt="" width={24} height={24} aria-hidden />
      </Link>
    </div>
  );
}
