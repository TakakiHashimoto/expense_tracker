function DashboarHeader() {
  return (
    <header className="fixed top-0 right-0 left-72 h-24 bg-slate-950/40 backdrop-blur-md flex justify-between items-center px-12 z-40">
      <h1 className="text-3xl font-bold tracking-tight text-slate-100">
        Dashboard
      </h1>
      <div className="flex items-center gap-6">
        <div className="relative group">
          <span className="absolute top-0 right-0 w-2 h-2 bg-primary rounded-full border-2 border-surface"></span>
        </div>
        <button className="bg-primary text-on-primary px-6 py-2.5 rounded-xl font-bold text-sm tracking-wide active:scale-[0.98] transition-transform shadow-lg shadow-primary/20">
          Sync Bank
        </button>
      </div>
    </header>
  );
}

export default DashboarHeader;
