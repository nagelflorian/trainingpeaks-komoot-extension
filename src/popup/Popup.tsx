/**
 * Extension popup.
 *
 * Auth strategy: detect the existing browser Komoot session (works for
 * Apple Sign In, Google, email/password — any login method). No credentials
 * are ever stored by this extension.
 *
 * If no session is detected, the user is prompted to log in at komoot.com.
 * After logging in there, they click "I'm logged in" to re-check.
 */

import React, { useEffect, useState } from "react";
import TAB_ICON_SVG from "../content/tabIcon.svg?raw";
import browser from "webextension-polyfill";
import type { ExtensionMessage, ExtensionResponse } from "../types/messages";

async function sendMessage(msg: ExtensionMessage): Promise<ExtensionResponse> {
  return browser.runtime.sendMessage(msg) as Promise<ExtensionResponse>;
}

type AuthState =
  | { status: "checking" }
  | { status: "logged_in"; displayName: string }
  | { status: "logged_out" }
  | { status: "error"; message: string };

export default function Popup(): React.ReactElement {
  const [auth, setAuth] = useState<AuthState>({ status: "checking" });
  const [rechecking, setRechecking] = useState(false);

  const checkSession = async () => {
    try {
      const res = await sendMessage({ type: "GET_AUTH_STATUS" });
      if (res.type === "AUTH_STATUS") {
        if (res.payload.loggedIn && res.payload.displayName) {
          setAuth({
            status: "logged_in",
            displayName: res.payload.displayName,
          });
        } else {
          setAuth({ status: "logged_out" });
        }
      }
    } catch (err) {
      setAuth({
        status: "error",
        message: err instanceof Error ? err.message : "Connection error",
      });
    }
  };

  useEffect(() => {
    checkSession();
  }, []);

  const handleRecheck = async () => {
    setRechecking(true);
    await checkSession();
    setRechecking(false);
  };

  const handleLogout = async () => {
    await sendMessage({ type: "LOGOUT" });
    setAuth({ status: "logged_out" });
  };

  const openKomoot = () => {
    browser.tabs.create({ url: "https://www.komoot.com/login" });
  };

  return (
    <div className="w-72 font-sans">
      {/* Header */}
      <div className="bg-primary text-primary-text px-4 py-3 flex items-center gap-2">
        <span
          className="inline-flex items-center"
          style={{ filter: "brightness(0) invert(1)" }}
          dangerouslySetInnerHTML={{ __html: TAB_ICON_SVG }}
        />
        <div>
          <h1 className="font-bold text-sm leading-tight">TP Komoot Plugin</h1>
          <p className="text-xs text-green-100">TrainingPeaks × Komoot</p>
        </div>
      </div>

      <div className="p-4">
        {auth.status === "checking" && (
          <div className="text-center text-gray-400 py-4 text-sm">
            Checking Komoot session…
          </div>
        )}

        {auth.status === "logged_in" && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm">
              <span className="w-2 h-2 bg-green-500 rounded-full flex-shrink-0" />
              <span className="text-gray-800">
                Connected as <strong>{auth.displayName}</strong>
              </span>
            </div>
            <p className="text-xs text-gray-500">
              Navigate to any TrainingPeaks workout to see Komoot suggestions.
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => browser.runtime.openOptionsPage?.()}
                className="flex-1 text-xs text-gray-600 border border-gray-300 rounded py-1.5 hover:bg-gray-50"
              >
                ⚙ Options
              </button>
              <button
                onClick={handleLogout}
                className="flex-1 text-xs text-red-600 border border-red-300 rounded py-1.5 hover:bg-red-50"
              >
                Disconnect
              </button>
            </div>
          </div>
        )}

        {auth.status === "logged_out" && (
          <div className="space-y-3">
            <p className="text-xs text-gray-600">
              Log in to Komoot in your browser, then click the button below.
              Works with Apple Sign In, Google, or email/password.
            </p>
            <button
              onClick={openKomoot}
              className="w-full bg-primary text-primary-text text-sm font-medium py-2 rounded hover:bg-primary-hover transition-colors"
            >
              Open Komoot to sign in ↗
            </button>
            <button
              onClick={handleRecheck}
              disabled={rechecking}
              className="w-full text-sm text-gray-600 border border-gray-300 py-1.5 rounded hover:bg-gray-50 disabled:opacity-50"
            >
              {rechecking ? "Checking…" : "I'm logged in — connect"}
            </button>
          </div>
        )}

        {auth.status === "error" && (
          <div className="space-y-3">
            <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded px-2 py-1">
              {auth.message}
            </p>
            <button
              onClick={handleRecheck}
              className="w-full text-sm text-gray-600 border border-gray-300 py-1.5 rounded hover:bg-gray-50"
            >
              Retry
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
