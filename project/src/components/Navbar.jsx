import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Brain, Menu, X, LogOut } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useMsal } from "@azure/msal-react";

const Navbar = ({ isPublicPage }) => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { instance, accounts } = useMsal();
  const navigate = useNavigate();

  const isAuthenticated = accounts.length > 0;

  useEffect(() => {
    if (isAuthenticated) {
      const account = instance.getActiveAccount() || accounts[0];
      console.log("Active account details:", account);
    }
  }, [isAuthenticated, instance, accounts]);

  const extractUserName = () => {
    if (!isAuthenticated) return "";

    const account = instance.getActiveAccount() || accounts[0];

    return (
      account?.name ||
      account?.idTokenClaims?.name ||
      account?.idTokenClaims?.given_name ||
      account?.idTokenClaims?.identity?.displayName ||
      account?.idTokenClaims?.identity?.firstName ||
      (account?.idTokenClaims?.emails && account?.idTokenClaims?.emails[0]) ||
      account?.username?.split("@")[0] ||
      "User"
    );
  };

  const userName = extractUserName();
  const displayName = userName.split(" ")[0] || "User";

  const handleSignOut = async () => {
    await instance.logoutPopup();
    navigate("/signin");
  };

  return (
    <nav className="bg-white shadow-sm sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex items-center">
            <Link to="/" className="flex items-center group">
              <motion.div
                whileHover={{ rotate: 360 }}
                transition={{ duration: 0.5 }}
                className="relative"
              >
                <Brain className="h-8 w-8 text-primary-600" />
              </motion.div>
              <span className="ml-2 text-xl font-bold text-gray-900 group-hover:text-primary-600 transition-colors">
                BluStudy
              </span>
            </Link>

            {!isPublicPage && (
              <div className="hidden sm:ml-6 sm:flex sm:space-x-8">
                <NavLink to="/dashboard">Dashboard</NavLink>
                <NavLink to="/tools">Study Tools</NavLink>
                <NavLink to="/workspace">Workspace</NavLink>
                {/* <NavLink to="/public_library">Public Library</NavLink> */}
              </div>
            )}
          </div>

          <div className="hidden sm:flex sm:items-center sm:space-x-4">
            {isAuthenticated ? (
              <>
                {!isPublicPage ? (
                  <>
                    <span className="text-gray-700 font-medium">{displayName}</span>
                    <button
                      onClick={handleSignOut}
                      className="flex items-center button-secondary"
                    >
                      <LogOut className="h-4 w-4 mr-1" />
                      Sign Out
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => navigate("/tools")}
                    className="button-primary"
                  >
                    Go to Study Tools
                  </button>
                )}
              </>
            ) : (
              <Link to="/signin" className="button-primary">
                Log In
              </Link>
            )}
          </div>

          <div className="flex items-center sm:hidden">
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="p-2 rounded-md text-gray-400 hover:text-gray-500 hover:bg-gray-100"
            >
              {isMobileMenuOpen ? (
                <X className="h-6 w-6" />
              ) : (
                <Menu className="h-6 w-6" />
              )}
            </button>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="sm:hidden bg-white border-t border-gray-200"
          >
            <div className="px-2 pt-2 pb-3 space-y-1">
              {!isPublicPage && (
                <>
                  <MobileNavLink to="/dashboard">Dashboard</MobileNavLink>
                  <MobileNavLink to="/tools">Study Tools</MobileNavLink>
                  <MobileNavLink to="/workspace">Workspace</MobileNavLink>
                  {/* <MobileNavLink to="/public_library">Public Library</MobileNavLink> */}
                </>
              )}

              {isAuthenticated ? (
                <>
                  {isPublicPage ? (
                    <button
                      onClick={() => {
                        setIsMobileMenuOpen(false);
                        navigate("/tools");
                      }}
                      className="w-full text-left block px-3 py-2 rounded-md text-base font-medium text-gray-900 hover:text-primary-600 hover:bg-gray-50 transition-colors"
                    >
                      Go to Study Tools
                    </button>
                  ) : (
                    <button
                      onClick={handleSignOut}
                      className="w-full text-left block px-3 py-2 rounded-md text-base font-medium text-gray-900 hover:text-primary-600 hover:bg-gray-50 transition-colors"
                    >
                      Sign Out
                    </button>
                  )}
                </>
              ) : (
                <MobileNavLink to="/signin">Log In</MobileNavLink>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
};

const NavLink = ({ to, children }) => (
  <Link
    to={to}
    className="text-gray-900 hover:text-primary-600 px-3 py-2 rounded-md text-sm font-medium transition-colors"
  >
    {children}
  </Link>
);

const MobileNavLink = ({ to, children }) => (
  <Link
    to={to}
    className="block px-3 py-2 rounded-md text-base font-medium text-gray-900 hover:text-primary-600 hover:bg-gray-50 transition-colors"
  >
    {children}
  </Link>
);

export default Navbar;