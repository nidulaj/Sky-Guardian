import { redirect } from 'next/navigation';

export default function NewJourneyRedirectPage() {
  redirect('/dashboard');
}
