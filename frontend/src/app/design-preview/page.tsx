import WindowIllustration from '@/components/ui/WindowIllustration';
import SiteHeader from '@/components/ui/SiteHeader';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import Barcode from '@/components/ui/Barcode';
import PageHeader from '@/components/ui/PageHeader';

export default function DesignPreview() {
  return (
    <div className="min-h-screen">
      <div className="relative overflow-hidden m-3 rounded-4xl bg-gradient-to-br from-cabin-light via-cabin to-cabin-dark min-h-[640px]">
        <SiteHeader variant="overlay" section="marketing" />
        <WindowIllustration className="absolute right-[4%] top-1/2 -translate-y-1/2 h-[88%]" />
        <div className="relative z-10 px-8 pt-56 max-w-xl text-white space-y-6">
          <p className="font-mono text-[11px] uppercase tracking-label text-white/80">Flight disruption intelligence</p>
          <h1 className="display text-7xl">Predict the disruption. <span className="accent text-coral-peach">Protect the journey.</span></h1>
        </div>
      </div>
      <div className="max-w-5xl mx-auto p-8 space-y-6">
        <PageHeader eyebrow="02 / History" title="Every journey," accent="remembered." description="Description text." actions={<Button>Primary</Button>} />
        <div className="flex flex-wrap gap-3"><Button>Primary</Button><Button variant="accent">Accent</Button><Button variant="secondary">Secondary</Button><Button variant="outline">Outline</Button><Button variant="ghost">Ghost</Button><Button isLoading>x</Button></div>
        <div className="flex flex-wrap gap-2">{['ON_TIME','DELAYED','HIGH_RISK','LIKELY_MISSED','CANCELLED','UNKNOWN','SCHEDULED'].map(s=><Badge key={s} status={s} />)}</div>
        <Barcode value="CMB-KUL-NRT" className="h-10 w-48 text-ink" />
      </div>
    </div>
  );
}
