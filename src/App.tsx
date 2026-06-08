import AskKeshavChat from "../components/AskKeshavChat";

const links = [
  { href: "https://endobio.ai", label: "endobio" },
  { href: "https://www.twitter.com/keshavdial", label: "twitter" },
  { href: "https://www.github.com/keshavd", label: "github" },
  { href: "https://ca.linkedin.com/in/keshavdial", label: "linkedin" },
  {
    href: "mailto:keshav.dial@gmail.com?Subject=GitHub%20Redirected%20Email",
    label: "email"
  }
];

export default function App() {
  return (
    <main className="home">
      <section className="identity" aria-label="Profile">
        <div>
          <h1>Keshav Dial</h1>
          <p>Doctor.Builder.Entrepreneur</p>
        </div>

        <nav className="links" aria-label="Social links">
          {links.map((link) => (
            <a key={link.href} href={link.href}>
              {link.label}
            </a>
          ))}
        </nav>
      </section>
      <AskKeshavChat />
    </main>
  );
}
