import { NavBar } from '@/components/nav-bar'
import { HomeGame } from '@/components/home/home-game'

export default function HomePage() {
  return (
    <div className="min-h-screen bg-background">
      <NavBar showTopicPill />
      <main>
        <HomeGame />
      </main>
    </div>
  )
}
