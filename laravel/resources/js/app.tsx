import '../css/app.css'

import { createInertiaApp } from '@inertiajs/react'
import PublicLayout from './layouts/PublicLayout'

createInertiaApp({
    pages: './pages',
    layout: () => PublicLayout,
    strictMode: true,
})
