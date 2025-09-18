'use client';

import { SignedIn, SignedOut, useUser } from "@clerk/nextjs";
import Link from "next/link";
import { useParams } from 'next/navigation';

export default function Dashboard() {
  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900">
      <SignedOut>
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <h1 className="text-2xl font-bold mb-4">Please sign in to view your dashboard</h1>
            <Link href="/" className="bg-orange-500 text-white px-4 py-2 rounded">
              Go to Home
            </Link>
          </div>
        </div>
      </SignedOut>

      <SignedIn>
        <DashboardContent />
      </SignedIn>
    </div>
  );
}

function DashboardContent() {
  const { user } = useUser();
  const params = useParams();
  const locale = params.locale as string;

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Simple Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
          🎹 Welcome to your Dashboard, {user?.firstName || 'Music Lover'}!
        </h1>

        <div className="flex gap-4 mb-6">
          <Link href={`/${locale}/concerts`}>
            <button className="bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded">
              Browse Concerts
            </button>
          </Link>
          <Link href={`/${locale}/concerts`}>
            <button className="bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded">
              Back to Concerts
            </button>
          </Link>
        </div>
      </div>

      {/* User Profile */}
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4">Your Profile</h2>
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 bg-orange-500 rounded-full flex items-center justify-center text-white text-2xl font-bold">
            {user?.firstName?.charAt(0) || user?.username?.charAt(0) || "U"}
          </div>
          <div>
            <h3 className="text-lg font-medium">{user?.firstName} {user?.lastName}</h3>
            <p className="text-gray-600">{user?.primaryEmailAddress?.emailAddress}</p>
            <p className="text-sm text-gray-500">
              Member since: {user?.createdAt ? new Date(user.createdAt).toLocaleDateString() : "N/A"}
            </p>
          </div>
        </div>
      </div>

      {/* Simple Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-white dark:bg-gray-800 rounded-lg p-4">
          <h3 className="font-semibold">Listening Time</h3>
          <p className="text-2xl font-bold text-orange-500">24h 32m</p>
          <p className="text-sm text-gray-600">This month</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg p-4">
          <h3 className="font-semibold">Favorite Pieces</h3>
          <p className="text-2xl font-bold text-orange-500">12</p>
          <p className="text-sm text-gray-600">Saved compositions</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg p-4">
          <h3 className="font-semibold">Playlists</h3>
          <p className="text-2xl font-bold text-orange-500">5</p>
          <p className="text-sm text-gray-600">Created collections</p>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6">
        <h2 className="text-xl font-semibold mb-4">Recent Activity</h2>
        <div className="space-y-3">
          <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-700 rounded">
            <span className="text-2xl">🎵</span>
            <div>
              <p className="font-medium">Listened to &quot;Bach&apos;s Toccata and Fugue&quot;</p>
              <p className="text-sm text-gray-600">2 hours ago</p>
            </div>
          </div>
          <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-700 rounded">
            <span className="text-2xl">❤️</span>
            <div>
              <p className="font-medium">Added to favorites &quot;Messiah Organ Prelude&quot;</p>
              <p className="text-sm text-gray-600">5 hours ago</p>
            </div>
          </div>
          <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-700 rounded">
            <span className="text-2xl">📝</span>
            <div>
              <p className="font-medium">Created playlist &quot;Classical Organ Works&quot;</p>
              <p className="text-sm text-gray-600">1 day ago</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}


