import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
} from "react";

const AuthContext = createContext(null);

const apiUrl = import.meta.env.VITE_API_URL || "";

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const checkAuth = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${apiUrl}/api/users/`, {
        method: "GET",
        credentials: "include",
      });

      if (response.ok) {
        const data = await response.json();
        setUser(data.user || { authenticated: true });
      } else {
        setUser(null);
      }
    } catch (fetchError) {
      setUser(null);
      setError(fetchError.message || "Unable to verify authentication.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  const login = async ({ email, password }) => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${apiUrl}/api/users/login`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Login failed.");
      }

      setUser(data.user);
      return data;
    } catch (loginError) {
      setError(loginError.message);
      throw loginError;
    } finally {
      setLoading(false);
    }
  };

  const register = async ({ username, email, password }) => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${apiUrl}/api/users/register`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ username, email, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Registration failed.");
      }

      return data;
    } catch (registerError) {
      setError(registerError.message);
      throw registerError;
    } finally {
      setLoading(false);
    }
  };

  const updateProfile = async ({
    username,
    email,
    oldPassword,
    newPassword,
    confirmPassword,
  }) => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${apiUrl}/api/users/profile`, {
        method: "PATCH",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          username,
          email,
          oldPassword,
          newPassword,
          confirmPassword,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Profile update failed.");
      }

      if (data.user) {
        setUser(data.user);
      }

      return data;
    } catch (updateError) {
      setError(updateError.message);
      throw updateError;
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    try {
      await fetch(`${apiUrl}/api/users/logout`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
      });
    } catch (logoutError) {
      console.warn("Logout failed", logoutError);
    } finally {
      setUser(null);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        error,
        login,
        logout,
        checkAuth,
        register,
        updateProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider");
  }
  return context;
}
