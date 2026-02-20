export default function DashboardMesaje() {
  return (
    <>
      <header className="mb-6 md:mb-8 p-5 md:p-6 rounded-2xl bg-gradient-to-br from-white via-[#faf8ff] to-[#f3efff] border border-[rgba(122,99,241,0.12)] shadow-[0_4px_20px_rgba(122,99,241,0.08)]">
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-[#1e1c2f]">Mesaje</h1>
        <p className="text-gray-500 text-sm mt-1.5 max-w-md">Conversații cu candidații și echipa.</p>
      </header>
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-8 text-center">
        <p className="text-gray-500">Nu ai mesaje noi. Aici vor apărea conversațiile cu candidații.</p>
      </div>
    </>
  );
}
