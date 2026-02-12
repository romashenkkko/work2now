import { Navigate, Link } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";

const STATS = [
  { label: "Aplicatii", value: "32", meta: "+8 azi" },
  { label: "Check-in & Check-out", value: "14", meta: "2 intarzieri" },
  { label: "Rating", value: "4.8", meta: "Din 120 recenzii" },
  { label: "Buget", value: "€12.4k", meta: "Disponibil luna asta", highlight: true },
];

const JOBS = [
  { job: "Barista", location: "Chisinau", status: "Confirmat", statusClass: "bg-green-100 text-green-800", date: "Astazi" },
  { job: "Receptioner", location: "Bucuresti", status: "In asteptare", statusClass: "bg-amber-100 text-amber-800", date: "Astazi" },
  { job: "Housekeeping", location: "Cluj", status: "Draft", statusClass: "bg-gray-100 text-gray-700", date: "Maine" },
];

const CANDIDATES = [
  { name: "Maria Popa", role: "Hospitality · 5 ani", img: "/Illustration/AvatarWhiteGirl.png" },
  { name: "David Ionescu", role: "Barista · 3 ani", img: "/Illustration/AvatarBlackGuy.png" },
];

export default function Dashboard() {
  const { user, loading, logout } = useAuth();
  if (loading) return <div className="container mx-auto px-4 py-16 text-center">Loading...</div>;
  if (!user) return <Navigate to="/login" replace />;

  return (
    <div className="flex min-h-screen bg-gray-100">
      <aside className="w-64 bg-white border-r border-secondary/10 flex flex-col shadow-soft">
        <div className="p-4 border-b border-secondary/10 flex items-center gap-2">
          <img src="/LogoWork2Now.png" alt="Work2Now" className="h-8 w-auto" />
          <span className="font-bold text-gray-900">Work2Now</span>
        </div>
        <button type="button" className="m-4 py-3 rounded-2xl bg-primary text-white font-semibold hover:bg-primary-dark shadow-soft transition-all">
          + Posteaza un job
        </button>
        <nav className="flex-1 px-4 py-2 space-y-1">
          <Link to="/dashboard" className="block px-4 py-2 rounded-lg bg-primary/10 text-primary font-medium">Home</Link>
          <a href="#" className="block px-4 py-2 rounded-lg text-gray-600 hover:bg-gray-100">Joburi</a>
          <a href="#" className="block px-4 py-2 rounded-lg text-gray-600 hover:bg-gray-100">Aplicatii</a>
          <a href="#" className="block px-4 py-2 rounded-lg text-gray-600 hover:bg-gray-100">Rapoarte</a>
          <a href="#" className="block px-4 py-2 rounded-lg text-gray-600 hover:bg-gray-100">Calendar</a>
          <a href="#" className="block px-4 py-2 rounded-lg text-gray-600 hover:bg-gray-100">Mesaje</a>
        </nav>
        <div className="p-4 border-t border-gray-200">
          <div className="flex items-center gap-3 mb-3">
            <img src="/Illustration/AvatarWhiteGuy.png" alt="" className="w-10 h-10 rounded-full object-cover" />
            <div>
              <p className="font-semibold text-gray-900">{user.name}</p>
              <span className="text-sm text-gray-500">Manager</span>
            </div>
          </div>
          <button type="button" onClick={logout} className="text-sm text-primary font-medium hover:underline">
            Logout
          </button>
        </div>
      </aside>

      <main className="flex-1 p-8 overflow-auto">
        <header className="flex flex-wrap items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Hello, {user.name}</h1>
            <p className="text-gray-600">Hai sa vedem statusul pentru azi.</p>
          </div>
          <div className="flex items-center gap-4">
            <input type="search" placeholder="Cauta joburi, persoane..." className="px-4 py-2 rounded-xl border border-gray-200 w-64 focus:ring-2 focus:ring-primary" />
            <button type="button" className="px-4 py-2 rounded-xl border border-gray-300 hover:bg-gray-50 font-medium">+ Creeaza</button>
            <span className="w-8 h-8 rounded-full bg-accent text-white flex items-center justify-center text-sm font-bold shadow-accent">3</span>
          </div>
        </header>

        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {STATS.map((s) => (
            <article key={s.label} className={`p-6 rounded-2xl bg-white border border-gray-200 shadow-sm ${s.highlight ? "border-primary/30 bg-primary/5" : ""}`}>
              <h3 className="text-sm font-medium text-gray-500 mb-1">{s.label}</h3>
              <p className="text-2xl font-bold text-gray-900">{s.value}</p>
              <span className="text-sm text-gray-500">{s.meta}</span>
            </article>
          ))}
        </section>

        <section className="grid lg:grid-cols-2 gap-8 mb-8">
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-gray-200 flex items-center justify-between">
              <h2 className="font-bold text-gray-900">Joburile de azi</h2>
              <button type="button" className="text-sm px-3 py-1.5 rounded-lg border border-gray-200 hover:bg-gray-50">+ Job nou</button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="text-left text-sm text-gray-500 border-b border-gray-100">
                    <th className="p-4">Job</th>
                    <th className="p-4">Locatie</th>
                    <th className="p-4">Status</th>
                    <th className="p-4">Data</th>
                  </tr>
                </thead>
                <tbody>
                  {JOBS.map((row) => (
                    <tr key={row.job} className="border-b border-gray-50 hover:bg-gray-50/50">
                      <td className="p-4 font-medium text-gray-900">{row.job}</td>
                      <td className="p-4 text-gray-600">{row.location}</td>
                      <td className="p-4"><span className={`px-2 py-1 rounded-lg text-xs font-medium ${row.statusClass}`}>{row.status}</span></td>
                      <td className="p-4 text-gray-600">{row.date}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
            <h2 className="font-bold text-gray-900 mb-4">Activitate</h2>
            <div className="flex items-end gap-2 h-32">
              {[40, 65, 55, 80, 50, 70, 60].map((h, i) => (
                <div key={i} className="flex-1 bg-primary/30 rounded-t min-h-[8px]" style={{ height: `${h}%` }} />
              ))}
            </div>
            <div className="flex gap-2 mt-4">
              <button type="button" className="px-3 py-1.5 rounded-lg bg-primary text-white text-sm font-medium">Saptamana</button>
              <button type="button" className="px-3 py-1.5 rounded-lg border border-gray-200 text-sm">Luna</button>
              <button type="button" className="px-3 py-1.5 rounded-lg border border-gray-200 text-sm">An</button>
            </div>
          </div>
        </section>

        <section className="grid lg:grid-cols-2 gap-8">
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
            <h2 className="font-bold text-gray-900 mb-4">Quick actions</h2>
            <div className="grid grid-cols-2 gap-3">
              <button type="button" className="px-4 py-3 rounded-xl border border-gray-200 hover:bg-gray-50 font-medium text-sm">Adauga job</button>
              <button type="button" className="px-4 py-3 rounded-xl border border-gray-200 hover:bg-gray-50 font-medium text-sm">Invite staff</button>
              <button type="button" className="px-4 py-3 rounded-xl border border-gray-200 hover:bg-gray-50 font-medium text-sm">Genereaza raport</button>
              <button type="button" className="px-4 py-3 rounded-xl border border-gray-200 hover:bg-gray-50 font-medium text-sm">Setari echipa</button>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-gray-200 flex items-center justify-between">
              <h2 className="font-bold text-gray-900">Candidati recomandati</h2>
              <a href="#" className="text-sm text-primary font-medium hover:underline">Vezi tot</a>
            </div>
            <div className="divide-y divide-gray-100">
              {CANDIDATES.map((c) => (
                <div key={c.name} className="p-4 flex items-center justify-between hover:bg-gray-50/50">
                  <div className="flex items-center gap-3">
                    <img src={c.img} alt="" className="w-12 h-12 rounded-full object-cover" />
                    <div>
                      <p className="font-semibold text-gray-900">{c.name}</p>
                      <span className="text-sm text-gray-500">{c.role}</span>
                    </div>
                  </div>
                  <button type="button" className="px-3 py-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 text-sm font-medium">Invita</button>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
