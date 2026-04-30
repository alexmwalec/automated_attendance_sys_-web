import React, { useEffect, useState } from "react";
import axios from "axios";

const Profile = () => {
  const [users, setUsers] = useState([]);
  const [form, setForm] = useState({
    name: "",
    email: "",
    role: "lecturer",
    department: ""
  });

  // Fetch users
  const fetchUsers = async () => {
    const res = await axios.get("http://localhost:5000/api/users");
    setUsers(res.data);
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  // Add user
  const handleAdd = async () => {
    if (!form.name || !form.email) return;

    await axios.post("http://localhost:5000/api/users", form);
    setForm({ name: "", email: "", role: "lecturer", department: "" });
    fetchUsers();
  };

  // Delete user
  const handleDelete = async (id) => {
    await axios.delete(`http://localhost:5000/api/users/${id}`);
    fetchUsers();
  };

  return (
    <div className="flex flex-col gap-6">

      <h2 className="text-xl font-bold text-teal-700">User Management</h2>

      {/* Form */}
      <div className="bg-white p-4 rounded shadow grid grid-cols-1 md:grid-cols-4 gap-3">
        <input
          type="text"
          placeholder="Full Name"
          className="border p-2 rounded"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
        />

        <input
          type="email"
          placeholder="Email"
          className="border p-2 rounded"
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
        />

        <select
          className="border p-2 rounded"
          value={form.role}
          onChange={(e) => setForm({ ...form, role: e.target.value })}
        >
          <option value="lecturer">Lecturer</option>
          <option value="invigilator">Invigilator</option>
        </select>

        <input
          type="text"
          placeholder="Department"
          className="border p-2 rounded"
          value={form.department}
          onChange={(e) => setForm({ ...form, department: e.target.value })}
        />

        <button
          onClick={handleAdd}
          className="col-span-1 md:col-span-4 bg-teal-600 text-white py-2 rounded hover:bg-teal-700"
        >
          Add User
        </button>
      </div>

      {/* Table */}
      <div className="bg-white rounded shadow overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-teal-500 text-white">
            <tr>
              <th className="p-2 text-left">Name</th>
              <th>Email</th>
              <th>Role</th>
              <th>Department</th>
              <th>Action</th>
            </tr>
          </thead>

          <tbody>
            {users.map((user) => (
              <tr key={user.id} className="border-b hover:bg-gray-50">
                <td className="p-2">{user.name}</td>
                <td>{user.email}</td>
                <td className="capitalize">{user.role}</td>
                <td>{user.department}</td>
                <td>
                  <button
                    onClick={() => handleDelete(user.id)}
                    className="bg-red-500 text-white px-2 py-1 rounded hover:bg-red-600"
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

    </div>
  );
};

export default Profile;