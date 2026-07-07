import { Link } from 'react-router-dom';
import { BarChart3, BookOpen, Files, GraduationCap, Inbox, Shield, Tags, Users } from 'lucide-react';

const adminAreas = [
  { to: '/admin/questions', label: 'Questions', description: 'Question bank, filters, review workflow', icon: BookOpen },
  { to: '/admin/tags', label: 'Tags', description: 'Section taxonomy management', icon: Tags },
  { to: '/admin/passage-bundles', label: 'PassageBundles', description: 'Atomic reading/science bundles', icon: Files },
  { to: '/admin/contributions', label: 'Contributions', description: 'Review community PDF/DOCX uploads', icon: Inbox },
  { to: '/admin/exams', label: 'Exams', description: 'Exam assembly and publishing', icon: GraduationCap },
  { to: '/admin/users', label: 'Users', description: 'Accounts and roles', icon: Users },
  { to: '/admin/access-codes', label: 'Access Codes', description: 'Locked exam access control', icon: Shield },
  { to: '/admin/analytics', label: 'Analytics', description: 'Usage and performance signals', icon: BarChart3 },
];

export default function AdminDashboard() {
  return (
    <div className="space-y-6">
      <header>
        <div className="flex items-center gap-2 text-sm font-medium text-primary-700">
          <BarChart3 className="h-4 w-4" />
          Admin Control Center
        </div>
        <h1 className="mt-2 text-2xl font-bold text-neutral-900">Dashboard</h1>
        <p className="mt-1 text-sm text-neutral-500">Điểm vào cho vận hành nội dung và exam management.</p>
      </header>

      <section className="grid gap-4 md:grid-cols-3">
        <Metric label="Sprint" value="2.1" />
        <Metric label="Focus" value="Question Bank" />
        <Metric label="Workflow" value="Review Ready" />
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {adminAreas.map(({ to, label, description, icon: Icon }) => (
          <Link key={to} to={to} className="card-hover block p-5">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary-50 text-primary-700">
                <Icon className="h-5 w-5" />
              </div>
              <div>
                <h2 className="font-semibold text-neutral-900">{label}</h2>
                <p className="mt-1 text-sm text-neutral-500">{description}</p>
              </div>
            </div>
          </Link>
        ))}
      </section>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="card p-5">
      <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">{label}</p>
      <p className="mt-2 text-xl font-bold text-neutral-900">{value}</p>
    </div>
  );
}
