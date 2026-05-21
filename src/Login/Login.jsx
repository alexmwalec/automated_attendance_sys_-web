import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { FiUser, FiLock, FiEye, FiEyeOff } from "react-icons/fi";

function Login() {
  const navigate = useNavigate();
  const [credentials, setCredentials] = useState({ username: "", password: "" });
  const [showPassword, setShowPassword] = useState(false);

  const handleChange = (e) => {
    setCredentials({ ...credentials, [e.target.name]: e.target.value });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    navigate("/dashboard");
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 px-4 py-8">
      <div className="w-full max-w-sm rounded-[28px] border border-slate-200 bg-white p-6 text-center shadow-xl sm:rounded-[32px] sm:p-8">
        <h1 className="mb-8 text-2xl font-bold tracking-[0.22em] text-teal-700 sm:text-3xl sm:tracking-[0.3em]">AAS PORTAL</h1>

        <form onSubmit={handleSubmit} className="space-y-4 text-left">

          {/* Username */}
          <div className="relative">
            <span className="absolute inset-y-0 left-3 flex items-center text-slate-400 pointer-events-none">
              <FiUser size={17} />
            </span>
            <label htmlFor="username" className="sr-only">Username</label>
            <input
              id="username"
              name="username"
              type="text"
              value={credentials.username}
              onChange={handleChange}
              placeholder="Username"
              className="w-full rounded-xl border border-slate-300 bg-slate-50 pl-10 pr-4 py-3 text-sm text-slate-700 outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
            />
          </div>

          {/* Password */}
          <div className="relative">
            <span className="absolute inset-y-0 left-3 flex items-center text-slate-400 pointer-events-none">
              <FiLock size={17} />
            </span>
            <label htmlFor="password" className="sr-only">Password</label>
            <input
              id="password"
              name="password"
              type={showPassword ? "text" : "password"}
              value={credentials.password}
              onChange={handleChange}
              placeholder="Password"
              className="w-full rounded-xl border border-slate-300 bg-slate-50 pl-10 pr-10 py-3 text-sm text-slate-700 outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute inset-y-0 right-3 flex items-center text-slate-400 hover:text-teal-600 transition-colors"
            >
              {showPassword ? <FiEyeOff size={17} /> : <FiEye size={17} />}
            </button>
          </div>

          <button
            type="submit"
            className="w-full rounded-xl bg-teal-700 py-3 text-sm font-semibold uppercase tracking-[0.2em] text-white transition hover:bg-teal-800"
          >
            Log In
          </button>
        </form>
      </div>
    </div>
  );
}

export default Login;
