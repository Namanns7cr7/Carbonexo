import { redirect } from 'next/navigation';

/** The landing moved to the home page; old /welcome links and bookmarks land there. */
export default function Welcome() {
  redirect('/');
}
