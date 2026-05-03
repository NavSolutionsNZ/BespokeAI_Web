import { redirect } from 'next/navigation'

// The marketing site lives at public/index.html
// Serve it unchanged by redirecting the root route there
export default function Home() {
  redirect('/index.html')
}
