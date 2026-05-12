import React from 'react';
import { Link } from 'react-router-dom';
import {
  TrendingUp,
  FlaskConical,
  AlertTriangle,
  FileText,
  ArrowRight,
  BookOpen,
  Database,
  Layers,
  Info,
} from 'lucide-react';
import clsx from 'clsx';

interface ModuleCard {
  title: string;
  description: string;
  href: string;
  icon: React.ElementType;
  accentColor: string;
  iconBg: string;
  iconColor: string;
  badge?: string;
}

const MODULE_CARDS: ModuleCard[] = [
  {
    title: 'Allometric Scaling',
    description:
      'Predict human clearance (CL) and volume of distribution (Vss) from multi-species animal pharmacokinetic data using established allometric methods.',
    href: '/allometry',
    icon: TrendingUp,
    accentColor: 'border-indigo-200 hover:border-indigo-400',
    iconBg: 'bg-indigo-100',
    iconColor: 'text-indigo-600',
    badge: '17 methods',
  },
  {
    title: 'IVIVE',
    description:
      'Extrapolate in vitro hepatic intrinsic clearance (CLint) to in vivo hepatic clearance using well-stirred, parallel-tube, and dispersion models.',
    href: '/ivive',
    icon: FlaskConical,
    accentColor: 'border-teal-200 hover:border-teal-400',
    iconBg: 'bg-teal-100',
    iconColor: 'text-teal-600',
    badge: '5 models',
  },
  {
    title: 'DDI Assessment',
    description:
      'Assess drug–drug interaction risk for CYP enzymes and transporters via reversible inhibition, time-dependent inhibition, and induction mechanisms.',
    href: '/ddi',
    icon: AlertTriangle,
    accentColor: 'border-amber-200 hover:border-amber-400',
    iconBg: 'bg-amber-100',
    iconColor: 'text-amber-600',
    badge: 'FDA/EMA guidance',
  },
  {
    title: 'Reporting',
    description:
      'Generate structured reports from completed analyses. Upload and compare prior session results across compounds and studies.',
    href: '/reporting',
    icon: FileText,
    accentColor: 'border-purple-200 hover:border-purple-400',
    iconBg: 'bg-purple-100',
    iconColor: 'text-purple-600',
    badge: 'PDF / JSON / HTML',
  },
];

const QUICKSTART_STEPS = [
  {
    step: 1,
    title: 'Enter compound metadata',
    body: 'Provide the compound name, MW, logP, and any relevant physico-chemical properties for your new molecular entity.',
    icon: Database,
  },
  {
    step: 2,
    title: 'Select a prediction module',
    body: 'Choose Allometric Scaling, IVIVE, or DDI Assessment depending on the data you have and the prediction question.',
    icon: Layers,
  },
  {
    step: 3,
    title: 'Configure methods and run',
    body: 'Select prediction methods, review assumptions, adjust physiological parameters if needed, then execute the analysis.',
    icon: FlaskConical,
  },
  {
    step: 4,
    title: 'Review results and export',
    body: 'Inspect back-predictions, warnings, and uncertainty ranges. Export a structured report for regulatory documentation.',
    icon: FileText,
  },
];

function ModuleCardItem({ card }: { card: ModuleCard }) {
  const Icon = card.icon;
  return (
    <Link
      to={card.href}
      className={clsx(
        'group flex flex-col rounded-xl border-2 bg-white p-6',
        'hover:shadow-lg transition-all duration-200',
        card.accentColor,
      )}
    >
      <div className="flex items-start justify-between mb-4">
        <div className={clsx('rounded-lg p-2.5', card.iconBg)}>
          <Icon className={clsx('h-6 w-6', card.iconColor)} aria-hidden="true" />
        </div>
        {card.badge && (
          <span className="text-xs font-medium text-slate-500 bg-slate-100 rounded-full px-2.5 py-0.5">
            {card.badge}
          </span>
        )}
      </div>

      <h3 className="text-base font-semibold text-slate-800 mb-2">{card.title}</h3>
      <p className="text-sm text-slate-500 leading-relaxed flex-1">{card.description}</p>

      <div
        className={clsx(
          'mt-5 flex items-center gap-1.5 text-sm font-medium',
          card.iconColor,
          'group-hover:gap-2.5 transition-all duration-150',
        )}
      >
        Launch
        <ArrowRight className="h-4 w-4" aria-hidden="true" />
      </div>
    </Link>
  );
}

function QuickStartSection() {
  return (
    <section className="mt-10">
      <div className="flex items-center gap-2 mb-5">
        <BookOpen className="h-5 w-5 text-slate-500" aria-hidden="true" />
        <h2 className="text-lg font-semibold text-slate-800">Quick Start Guide</h2>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {QUICKSTART_STEPS.map(({ step, title, body, icon: StepIcon }) => (
          <div
            key={step}
            className="relative flex flex-col rounded-xl border border-slate-200 bg-white p-5"
          >
            <div className="flex items-center gap-3 mb-3">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-xs font-bold text-white">
                {step}
              </span>
              <StepIcon className="h-4 w-4 text-slate-400" aria-hidden="true" />
            </div>
            <h3 className="text-sm font-semibold text-slate-700 mb-1.5">{title}</h3>
            <p className="text-xs text-slate-500 leading-relaxed">{body}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function VersionFooter() {
  return (
    <div className="mt-10 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-5 py-3">
      <div className="flex items-center gap-4 text-xs text-slate-500">
        <span>
          <span className="font-semibold text-slate-700">Formula Set</span> v1.0.0
        </span>
        <span className="text-slate-300">|</span>
        <span>
          <span className="font-semibold text-slate-700">Physiology DB</span> v1.0.0
        </span>
        <span className="text-slate-300">|</span>
        <span>
          <span className="font-semibold text-slate-700">App</span> v1.0.0
        </span>
      </div>
      <div className="flex items-start gap-1.5 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-1.5 max-w-lg">
        <Info className="h-3.5 w-3.5 shrink-0 mt-0.5 text-amber-500" aria-hidden="true" />
        <span>
          All predictions are exploratory and assumption-dependent. Not validated for clinical
          decision-making or regulatory submission without independent verification.
        </span>
      </div>
    </div>
  );
}

export default function Dashboard() {
  return (
    <div className="max-w-6xl mx-auto px-6 py-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <FlaskConical className="h-8 w-8 text-indigo-600" aria-hidden="true" />
          <h1 className="text-2xl font-bold text-slate-900">ClinPharm Toolkit</h1>
        </div>
        <p className="text-slate-500 text-base leading-relaxed max-w-2xl">
          Clinical Pharmacology Prediction Platform — supporting early DMPK decision-making
          through allometric scaling, IVIVE, and DDI risk assessment.
        </p>
      </div>

      {/* Module cards 2×2 grid */}
      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-400 mb-4">
          Prediction Modules
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          {MODULE_CARDS.map((card) => (
            <ModuleCardItem key={card.href} card={card} />
          ))}
        </div>
      </section>

      {/* Quick start */}
      <QuickStartSection />

      {/* Version / disclaimer footer */}
      <VersionFooter />
    </div>
  );
}
