import { useState, useEffect } from 'react';
import { getCurrentUser, loadUser, clearCurrentUser } from '../utils/storage';

export const useAuth = () => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const username = getCurrentUser();
    if (username) {
      const userData = loadUser(username);
      if (userData) setUser(userData);
    }
    setLoading(false);
  }, []);

  const logout = () => {
    clearCurrentUser();
    setUser(null);
  };

  return { user, setUser, logout, loading };
};
