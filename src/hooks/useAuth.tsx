import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, User, signInWithPopup, GoogleAuthProvider, signOut } from 'firebase/auth';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';

interface UserCollegeData {
  admissionYear: number | null;
  isLE: boolean;
  department: string | null;
  isEligibleVoter: boolean;
  isEligibleCandidate: boolean;
}

interface AuthContextType {
  user: User | null;
  role: 'admin' | 'voter' | null;
  collegeData: UserCollegeData | null;
  loading: boolean;
  login: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const parseCollegeEmail = (email: string): UserCollegeData => {
  const domain = "@cmrit.ac.in";
  if (!email.endsWith(domain)) {
    return { admissionYear: null, isLE: false, department: null, isEligibleVoter: false, isEligibleCandidate: false };
  }

  const prefix = email.split('@')[0];
  const yearMatch = prefix.match(/\d{2}/);
  const admissionYear = yearMatch ? parseInt(yearMatch[0]) : null;
  
  // LE logic: check if 'le' appears after branch code or in prefix
  const isLE = prefix.toLowerCase().includes('le');
  
  // Dept logic: extract characters after year
  let department = null;
  if (yearMatch) {
    const afterYear = prefix.split(yearMatch[0])[1];
    department = afterYear ? afterYear.replace('le', '').toUpperCase() : null;
  }

  return { admissionYear, isLE, department, isEligibleVoter: false, isEligibleCandidate: false };
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<'admin' | 'voter' | null>(null);
  const [collegeData, setCollegeData] = useState<UserCollegeData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setUser(user);
      if (user && user.email) {
        const cData = parseCollegeEmail(user.email);
        setCollegeData(cData);

        const userDoc = await getDoc(doc(db, 'users', user.uid));
        
        // Admin Whitelist: In production, this would be more robust
        const adminEmails = ['lakshmeeshagowda774@gmail.com'];
        const isAdmin = adminEmails.includes(user.email);

        if (userDoc.exists()) {
          // If whitelisted, force admin role if not already
          if (isAdmin && userDoc.data().role !== 'admin') {
             await updateDoc(doc(db, 'users', user.uid), { role: 'admin' });
             setRole('admin');
          } else {
             setRole(userDoc.data().role);
          }
        } else {
          const initialRole = isAdmin ? 'admin' : 'voter';
          await setDoc(doc(db, 'users', user.uid), {
            uid: user.uid,
            email: user.email,
            role: initialRole,
            collegeData: cData,
            createdAt: new Date().toISOString()
          });
          setRole(initialRole as any);
        }
      } else {
        setRole(null);
        setCollegeData(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const login = async () => {
    const provider = new GoogleAuthProvider();
    // Force select account and filter by domain if possible (Google doesn't strictly allow domain filter in popup without config)
    await signInWithPopup(auth, provider);
  };

  const logout = async () => {
    await signOut(auth);
  };

  return (
    <AuthContext.Provider value={{ user, role, collegeData, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
