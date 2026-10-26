
# Model 1 GitHub = 2 Vercel Project

Struktur ini yang kamu mau:
- input-simasy/
  - frontend/ -> deploy ke Vercel Project 1 (input-simasy.vercel.app) Root Directory = frontend
  - backend/ -> deploy ke Vercel Project 2 (input-simasy-backend.vercel.app) Root Directory = backend

Cara deploy:
1. Push folder ini ke GitHub edriv2014-prog/input-simasy
2. Di Vercel, Add New Project -> Import repo yang SAMA
   - Project A: Root Directory = frontend, Framework = Next.js
   - Project B: Root Directory = backend, Framework = Other, Build Command = npm run build
"# input-simasy" 
