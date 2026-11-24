import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import Layout from './components/Layout'
import RequireAuth from './components/RequireAuth'
import Login from './pages/Login'
import Projects from './pages/Projects'
import Dashboard from './pages/Dashboard'
import Supervisors from './pages/Supervisors'
import Analytics from './pages/Analytics'
import Settings from './pages/Settings'
import SupervisorDetail from './pages/SupervisorDetail'
import Costs from './pages/Costs'
import Reports from './pages/Reports'
import ProjectWorkspace from './pages/ProjectWorkspace'
import ProjectManagement from './pages/ProjectManagement'
import '@fontsource/poppins/400.css'
import '@fontsource/poppins/500.css'
import '@fontsource/poppins/600.css'
import './index.css'
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode><QueryClientProvider client={new QueryClient()}><BrowserRouter>
    <Routes><Route path="login" element={<Login />} /><Route element={<RequireAuth><Layout /></RequireAuth>}>
      <Route index element={<Navigate to="/dashboard" replace />} />
      <Route path="projects" element={<Projects />} />
      <Route path="projects/:projectId/:tab?" element={<ProjectWorkspace />} />
      <Route path="supervisors" element={<Supervisors />} />
      <Route path="supervisors/:id" element={<SupervisorDetail />} />
      <Route path="analytics" element={<Analytics />} />
      <Route path="settings" element={<Settings />} />
      <Route path="dashboard" element={<Dashboard />} />
      <Route path="project-management" element={<ProjectManagement />} />
      <Route path="project-management/work-done" element={<Costs />} />
      <Route path="project-management/:projectId/:tab?" element={<ProjectWorkspace />} />
      <Route path="reports" element={<Reports />} />
    </Route></Routes></BrowserRouter></QueryClientProvider></React.StrictMode>)
