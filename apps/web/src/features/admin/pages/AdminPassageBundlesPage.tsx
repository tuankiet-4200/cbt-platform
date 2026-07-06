import { Files, Plus, Search } from 'lucide-react';

export default function AdminPassageBundlesPage() {
  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm font-medium text-primary-700">
            <Files className="h-4 w-4" />
            PassageBundle Bank
          </div>
          <h1 className="mt-2 text-2xl font-bold text-neutral-900">PassageBundles</h1>
          <p className="mt-1 text-sm text-neutral-500">Quản lý bundle Đọc hiểu và Khoa học theo đơn vị atomic.</p>
        </div>
        <button className="btn btn-primary btn-md">
          <Plus className="h-4 w-4" />
          Tạo bundle
        </button>
      </header>

      <section className="card p-5">
        <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_12rem_12rem]">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-neutral-400" />
            <input className="input pl-9" placeholder="Search bundles" />
          </div>
          <select className="input" defaultValue="">
            <option value="">All sections</option>
            <option value="READING">READING</option>
            <option value="SCIENCE">SCIENCE</option>
          </select>
          <select className="input" defaultValue="">
            <option value="">All status</option>
            <option value="DRAFT">Draft</option>
            <option value="PUBLISHED">Published</option>
            <option value="ARCHIVED">Archived</option>
          </select>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {[
          { section: 'READING', title: 'Reading bundle draft', count: '10 questions' },
          { section: 'SCIENCE', title: 'Science stimulus draft', count: '5 questions' },
        ].map((bundle) => (
          <article key={bundle.section} className="card p-5">
            <span className="badge badge-primary">{bundle.section}</span>
            <h2 className="mt-4 font-semibold text-neutral-900">{bundle.title}</h2>
            <p className="mt-2 text-sm text-neutral-500">{bundle.count}</p>
            <div className="mt-5 h-2 rounded-full bg-neutral-100">
              <div className="h-2 w-2/3 rounded-full bg-primary-500" />
            </div>
          </article>
        ))}
      </section>
    </div>
  );
}
