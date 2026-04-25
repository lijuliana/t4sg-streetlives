import Link from "next/link";
import Image from "next/image";
import Navbar from "@/components/Navbar";
import TestimonialCarousel from "@/components/TestimonialCarousel";
import ChatFAB from "@/components/ChatFAB";
import { auth0 } from "@/lib/auth0";

const ROLES_CLAIM = "https://streetlives.app/roles";

const ROLE_DASHBOARD: Record<string, string> = {
  navigator: "/dashboard/navigator",
  supervisor: "/dashboard/supervisor",
  user: "/dashboard/user",
};

const services = [
  { icon: "/new-icons/house.svg",       name: "Accommodations",  description: "A place to stay, shelter, vouchers" },
  { icon: "/new-icons/store.svg",       name: "Food",            description: "Something to eat" },
  { icon: "/new-icons/bag.svg",         name: "Clothing",        description: "Something to wear" },
  { icon: "/new-icons/umbrella.svg",    name: "Personal Care",   description: "Shower, restroom, laundry" },
  { icon: "/new-icons/heart-chart.svg", name: "Health",          description: "Clinic, mental health, medicine" },
  { icon: "/new-icons/person.svg",      name: "Family Services", description: "Childcare, nursing, check-ups" },
  { icon: "/new-icons/checklist.svg",   name: "Work",            description: "Jobs, applications, training" },
  { icon: "/new-icons/scales.svg",      name: "Legal",           description: "Lawyers, court services, immigration" },
  { icon: "/new-icons/wifi.svg",        name: "Connection",      description: "Wi-fi, mailbox, computer room" },
  { icon: "/new-icons/cursor.svg",      name: "Services Nearby", description: "Browse services on a map" },
  { icon: "/new-icons/chat.svg",        name: "Need Help?",      description: "Use our chat assistant" },
];

export default async function HomePage() {
  const session = await auth0.getSession();
  const roles: string[] = (session?.user?.[ROLES_CLAIM] as string[]) ?? [];
  const matchedRole = roles.find((r) => ROLE_DASHBOARD[r] !== undefined) ?? (session ? "user" : null);
  const dashboard = matchedRole ? ROLE_DASHBOARD[matchedRole] : null;
  const staffDashboardHref = roles.includes("supervisor")
    ? "/dashboard/supervisor"
    : roles.includes("navigator")
      ? "/dashboard/navigator"
      : null;

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />

      {/* Hero */}
      <section className="bg-brand-yellow px-5 pt-10 pb-12">
        <h1 className="text-3xl font-medium leading-tight text-brand-dark max-w-xs">
          Peer-validated services for youth and young adults
        </h1>
        <p className="mt-3 text-sm text-brand-dark/80 max-w-xs">
          Search through hundreds of free support services in NYC that are right
          for you.
        </p>
        <button
          type="button"
          className="mt-6 bg-brand-dark text-white text-sm font-medium px-6 py-3 rounded-md hover:opacity-90 transition"
        >
          Get started below
        </button>
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
                <Image src={icon} alt="" width={24} height={24} aria-hidden className="flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-brand-dark text-sm underline">{name}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{description}</p>
                </div>
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="text-gray-400 flex-shrink-0"
                  aria-hidden
                >
                  <path d="M9 18l6-6-6-6" />
                </svg>
              </button>
            </li>
          ))}
        </ul>
      </section>

      {/* "You're not alone" */}
      <section className="bg-[#F5F5F5] px-5 pt-12 pb-10 text-center">
        <h2 className="text-2xl font-medium text-brand-dark leading-snug max-w-xs mx-auto">
          You&rsquo;re not alone in this journey
        </h2>
        <div className="flex justify-center my-6">
          <Image src="/new-icons/hands.svg" alt="" width={80} height={80} aria-hidden />
        </div>
        <p className="mt-4 text-sm text-gray-600 max-w-sm mx-auto leading-relaxed">
          People can experience homelessness for many reasons. Our peer
          navigators share their experiences navigating the support system,
          and their tips on how to prepare for the future.
        </p>
        <button
          type="button"
          className="mt-6 bg-brand-dark text-white text-sm font-medium px-6 py-3 rounded-md hover:opacity-90 transition"
        >
          Learn from Peers
        </button>
      </section>

      {/* Testimonial carousel */}
      <TestimonialCarousel />

      {/* Provider CTA */}
      <section className="bg-brand-yellow px-5 py-12 text-center">
        <h2 className="text-2xl font-medium text-brand-dark leading-snug max-w-xs mx-auto">
          Are you a service provider?
        </h2>
        <p className="text-brand-dark/70 text-sm mt-4 max-w-xs mx-auto space-y-1">
          Our provider portal can help you:<br />
          Keep clients updated about your services.<br />
          Find other providers for accurate referrals.<br />
          Learn about your clients.<br />
          Manage appointments.
        </p>
        <Link
          href="#"
          className="mt-6 inline-block bg-brand-dark text-white text-sm font-medium px-6 py-3 rounded-md hover:opacity-90 transition"
        >
          Sign into Provider Portal
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

      <ChatFAB staffDashboardHref={staffDashboardHref} />
    </div>
  );
}
