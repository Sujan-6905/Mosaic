"use client";

import { Provider } from "react-redux";
import { useRouter } from "next/router";
import { SessionProvider, useSession, signIn, signOut } from "next-auth/react";
import store from "@/store";
import Header from "@/components/Header";
import AuthModal from "@/components/AuthModal";
import Toast, { useToast } from "@/components/Toast";
import "@/styles/globals.css";
import axiosInstance from "@/axiosInstance";
import { useState } from "react";

function AppContent({ Component, pageProps }) {
  const router = useRouter();
  const { data: session, status } = useSession();
  const { toasts, removeToast, showToast } = useToast();

  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authMode, setAuthMode] = useState("login");
  const [authLoading, setAuthLoading] = useState(false);

  const isAuthenticated = !!session?.user;

  const handleAuthClick = (mode) => {
    setAuthMode(mode);
    setIsAuthModalOpen(true);
  };

  const handleAuthSubmit = async (formData) => {
    setAuthLoading(true);
    try {
      if (authMode === "login") {
        const result = await signIn("credentials", {
          redirect: false,
          email: formData.email,
          password: formData.password,
          callbackUrl: router.query.callbackUrl || "/",
        });

        if (result?.error) {
          throw new Error(result.error);
        }

        setIsAuthModalOpen(false);
        router.push(result.url || "/");
        showToast.success("Welcome back!", "Successfully signed in");
      } else {
        await axiosInstance.post("/api/auth/register", {
          name: formData.name,
          email: formData.email,
          password: formData.password,
        });
        setAuthMode("login");
        showToast.success("Account created successfully!", "Kindly login to continue");
      }
    } catch (error) {
      console.error("Auth error:", error);
      showToast.error(
        "Authentication failed",
        error.message || "Please try again"
      );
    } finally {
      setAuthLoading(false);
    }
  };

  const handleSocialAuth = async (provider) => {
    setAuthLoading(true);
    try {
      await signIn(provider, { callbackUrl: router.query.callbackUrl || "/" });
    } catch (error) {
      console.error("Social auth error:", error);
      showToast.error("Authentication failed", "Social authentication failed");
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = () => {
    signOut({ callbackUrl: "/" });
    showToast.info("Signed out", "You have been successfully signed out");
  };

  const handleSwitchAuthMode = () => {
    setAuthMode(authMode === "login" ? "register" : "login");
  };

  return (
    <div className="app">
      <Header
        isAuthenticated={isAuthenticated}
        user={session?.user || null}
        onAuthClick={handleAuthClick}
        onLogout={handleLogout}
        showToast={showToast}
      />

      <main className="main-content">
        <Component
          {...pageProps}
          isAuthenticated={isAuthenticated}
          user={session?.user || null}
          onAuthClick={handleAuthClick}
          showToast={showToast}
          onLogout={handleLogout}
        />
      </main>

      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        mode={authMode}
        onSwitchMode={handleSwitchAuthMode}
        onSubmit={handleAuthSubmit}
        onSocialAuth={handleSocialAuth}
        loading={authLoading}
      />

      <Toast toasts={toasts} removeToast={removeToast} />
    </div>
  );
}

export default function App({ Component, pageProps }) {
  return (
    <Provider store={store}>
      <SessionProvider session={pageProps.session}>
        <AppContent Component={Component} pageProps={pageProps} />
      </SessionProvider>
    </Provider>
  );
}
