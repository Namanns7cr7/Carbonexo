import { redirect } from 'next/navigation';

/** The cinematic preview became the product: its planet lives in /welcome and the app. */
export default function ExperiencePreviewPage() {
  redirect('/welcome');
}
