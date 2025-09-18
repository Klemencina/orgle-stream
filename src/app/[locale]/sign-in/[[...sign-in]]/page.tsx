import { SignIn } from "@clerk/nextjs";

export default function SignInPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <SignIn
          appearance={{
            baseTheme: undefined,
            variables: {
              colorPrimary: "#f97316", // orange-500
            },
            elements: {
              card: "bg-white dark:bg-gray-800 shadow-lg border-0",
              headerTitle: "text-gray-900 dark:text-white",
              headerSubtitle: "text-gray-600 dark:text-gray-300",
              socialButtonsBlockButton: "border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700",
              formButtonPrimary: "bg-orange-500 hover:bg-orange-600 shadow-sm",
              footerActionLink: "text-orange-500 hover:text-orange-600",
            }
          }}
        />
      </div>
    </div>
  );
}


