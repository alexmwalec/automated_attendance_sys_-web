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
    <div className="min-h-screen bg-slate-100 flex items-center justify-center px-4">
      <div className="w-full max-w-sm bg-white rounded-[32px] shadow-xl border border-slate-200 p-8 text-center">
        <h1 className="text-3xl font-bold tracking-[0.3em] text-teal-700 mb-8">AAS PORTAL</h1>

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
            Sign In
          </button>
        </form>

        <button type="button" className="mt-6 text-sm text-teal-700 hover:underline">
          Forgot password
        </button>
      </div>
    </div>
  );
}

export default Login;