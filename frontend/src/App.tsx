import React from 'react'
import { Routes, Route } from 'react-router-dom'
import { Layout } from 'antd'
import HomePage from './pages/HomePage'
import ProjectDetailPage from './pages/ProjectDetailPage'
import SettingsPage from './pages/SettingsPage'
import Header from './components/Header'

const { Content } = Layout

function App() {
  return (
    <Layout style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Header />
      <Content style={{ flex: 1, display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/project/:id" element={<ProjectDetailPage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Routes>
      </Content>
    </Layout>
  )
}

export default App
