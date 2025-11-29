import React, { createContext, useContext, useState, useEffect } from "react";
import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Google from "expo-auth-session/providers/google";
import * as WebBrowser from "expo-web-browser";
import { makeRedirectUri } from "expo-auth-session";
import { api } from "../services/api";
import { connectSocket, disconnectSocket } from "../services/socket";

WebBrowser.maybeCompleteAuthSession();

const AuthContext = createContext();

const GOOGLE_CLIENT_ID =
  "87688464195-bherqspe5i9k1g1s92ap2c7aks3mr03d.apps.googleusercontent.com";

// Get the proper redirect URI for each platform
const redirectUri = makeRedirectUri({
  scheme: "id8",
  path: Platform.OS === "web" ? "" : undefined,
});

console.log("Google OAuth redirect URI:", redirectUri);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);

  const [request, response, promptAsync] = Google.useIdTokenAuthRequest({
    clientId: GOOGLE_CLIENT_ID,
    redirectUri,
    prompt: "select_account",
  });

  useEffect(() => {
    loadStoredAuth();
    // Check for auth response in URL on web
    if (Platform.OS === "web") {
      checkWebAuthResponse();
    }
  }, []);

  useEffect(() => {
    console.log("Auth response:", response);
    if (response?.type === "success") {
      const { id_token } = response.params;
      console.log("Got id_token:", id_token ? "yes" : "no");
      if (id_token) {
        handleGoogleAuth(id_token);
      } else {
        console.error("No id_token in response params:", response.params);
      }
    } else if (response?.type === "error") {
      console.error("Auth error:", response.error);
    } else if (response) {
      console.log("Auth response type:", response.type);
    }
  }, [response]);

  const checkWebAuthResponse = () => {
    // Check URL hash for id_token (implicit flow)
    if (typeof window !== "undefined") {
      const hash = window.location.hash;
      if (hash) {
        const params = new URLSearchParams(hash.substring(1));
        const idToken = params.get("id_token");
        if (idToken) {
          handleGoogleAuth(idToken);
          // Clean up URL
          window.history.replaceState(
            {},
            document.title,
            window.location.pathname,
          );
        }
      }
    }
  };

  const loadStoredAuth = async () => {
    try {
      const storedToken = await AsyncStorage.getItem("token");
      const storedUser = await AsyncStorage.getItem("user");

      if (storedToken && storedUser) {
        setToken(storedToken);
        setUser(JSON.parse(storedUser));
        api.setToken(storedToken);
        // Connect socket after restoring auth
        connectSocket();
      }
    } catch (e) {
      console.log("Error loading auth:", e);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleAuth = async (idToken) => {
    try {
      setLoading(true);
      console.log("Sending idToken to backend...");
      const response = await api.post("/auth/google", {
        idToken,
      });
      console.log("Backend response:", response);
      const { token: newToken, user: newUser } = response;

      if (!newToken || !newUser) {
        console.error("Missing token or user in response:", response);
        return;
      }

      await AsyncStorage.setItem("token", newToken);
      await AsyncStorage.setItem("user", JSON.stringify(newUser));

      api.setToken(newToken);
      setToken(newToken);
      setUser(newUser);
      connectSocket();
      console.log("Auth successful, user:", newUser.email);
    } catch (error) {
      console.error("Google auth error:", error.message || error);
    } finally {
      setLoading(false);
    }
  };

  const signIn = () => {
    promptAsync();
  };

  const signInWithEmail = async (email, password) => {
    setLoading(true);
    try {
      const response = await api.post("/auth/login", {
        email,
        password,
      });
      const { token: newToken, user: newUser } = response;

      await AsyncStorage.setItem("token", newToken);
      await AsyncStorage.setItem("user", JSON.stringify(newUser));

      api.setToken(newToken);
      setToken(newToken);
      setUser(newUser);
      connectSocket();
    } catch (error) {
      throw new Error(error.message || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  const registerWithEmail = async (email, password, name) => {
    setLoading(true);
    try {
      const response = await api.post("/auth/register", {
        email,
        password,
        name,
      });
      const { token: newToken, user: newUser } = response;

      await AsyncStorage.setItem("token", newToken);
      await AsyncStorage.setItem("user", JSON.stringify(newUser));

      api.setToken(newToken);
      setToken(newToken);
      setUser(newUser);
      connectSocket();
    } catch (error) {
      throw new Error(error.message || "Registration failed");
    } finally {
      setLoading(false);
    }
  };

  const signOut = async () => {
    disconnectSocket();
    await AsyncStorage.removeItem("token");
    await AsyncStorage.removeItem("user");
    api.setToken(null);
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        loading,
        signIn,
        signInWithEmail,
        registerWithEmail,
        signOut,
        updateUser: async (userData) => {
          const newUser = {
            ...user,
            ...userData,
          };
          setUser(newUser);
          await AsyncStorage.setItem("user", JSON.stringify(newUser));
        },
        isReady: request !== null,
      }}
    >
      
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
