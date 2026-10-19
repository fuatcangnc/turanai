import { animate, inView, stagger } from 'motion'

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
const isInViewport = (el: HTMLElement) => {
  const r = el.getBoundingClientRect()
  return r.top < window.innerHeight && r.bottom > 0
}

// ---------------------------------------------------------------------------
// Global reveal animations
// ---------------------------------------------------------------------------
const revealItems = document.querySelectorAll<HTMLElement>('[data-reveal]')
const processCore = document.querySelector<HTMLElement>('[data-process-core]')
const processIndicator = document.querySelector<HTMLElement>('[data-process-indicator]')

if (reducedMotion) {
  revealItems.forEach((item) => item.removeAttribute('data-reveal'))
} else {
  if (processCore) {
    animate(processCore, { scale: [1, 1.035, 1] }, { duration: 3.2, ease: 'easeInOut', repeat: Infinity })
  }
  if (processIndicator) {
    animate(processIndicator, { opacity: [0.45, 1, 0.45], scaleX: [0.82, 1.12, 0.82] }, { duration: 2.2, ease: 'easeInOut', repeat: Infinity })
  }
  revealItems.forEach((item) => {
    if (isInViewport(item)) return
    item.style.opacity = '0'
    item.style.transform = 'translateY(1.25rem)'
    inView(item, () => {
      animate(item, { opacity: 1, y: 0 }, { duration: 0.65, ease: [0.22, 1, 0.36, 1] })
    }, { amount: 0.16 })
  })

  document.querySelectorAll<HTMLElement>('[data-reveal-group]').forEach((group) => {
    if (isInViewport(group)) return
    const children = group.querySelectorAll<HTMLElement>('[data-reveal-item]')
    children.forEach((child) => {
      child.style.opacity = '0'
      child.style.transform = 'translateY(1.25rem)'
    })
    inView(group, () => {
      animate(children, { opacity: 1, y: 0 }, { delay: stagger(0.08), duration: 0.55, ease: [0.22, 1, 0.36, 1] })
    }, { amount: 0.16 })
  })
}

// ---------------------------------------------------------------------------
// Sticky header
// ---------------------------------------------------------------------------
const initStickyHeader = () => {
  const header = document.querySelector<HTMLElement>('#site-header')
  const navShell = header?.querySelector<HTMLElement>('.nav-shell')
  if (!header || !navShell) return

  let isSticky = false

  const handleScroll = () => {
    const shouldBeSticky = window.scrollY > 40
    if (shouldBeSticky !== isSticky) {
      isSticky = shouldBeSticky
      if (shouldBeSticky) {
        header.setAttribute('data-sticky', 'true')
        header.classList.add('is-sticky')
        animate(
          navShell,
          {
            y: [-18, 0],
            opacity: [0.5, 1],
            scale: [0.985, 1],
          },
          {
            duration: 0.3,
            ease: [0.16, 1, 0.3, 1],
          }
        )
      } else {
        header.removeAttribute('data-sticky')
        header.classList.remove('is-sticky')
        animate(
          navShell,
          {
            y: [0, 0],
            opacity: 1,
            scale: 1,
          },
          {
            duration: 0.2,
            ease: 'easeOut',
          }
        )
      }
    }
  }

  window.addEventListener('scroll', handleScroll, { passive: true })
  handleScroll()
}

// ---------------------------------------------------------------------------
// Why Choose Us section animations
// ---------------------------------------------------------------------------
const initWhyChooseUsAnimations = () => {
  const gridContainer = document.querySelector<HTMLElement>('.why-us-grid')
  if (gridContainer) {
    inView(gridContainer, () => {
      const leftCards = gridContainer.querySelectorAll<HTMLElement>('.why-feat-left')
      leftCards.forEach((card, i) => {
        animate(
          card,
          { transform: ['translateX(-40px)', 'translateX(0px)'], opacity: [0, 1] },
          { duration: 0.7, delay: i * 0.12, ease: [0.22, 1, 0.36, 1] }
        )
      })

      const centerCar = gridContainer.querySelector<HTMLElement>('.why-car-center')
      if (centerCar) {
        animate(
          centerCar,
          { transform: ['scale(0.94)', 'scale(1)'], opacity: [0, 1] },
          { duration: 0.8, delay: 0.05, ease: [0.22, 1, 0.36, 1] }
        )
      }

      const rightCards = gridContainer.querySelectorAll<HTMLElement>('.why-feat-right')
      rightCards.forEach((card, i) => {
        animate(
          card,
          { transform: ['translateX(40px)', 'translateX(0px)'], opacity: [0, 1] },
          { duration: 0.7, delay: i * 0.12, ease: [0.22, 1, 0.36, 1] }
        )
      })
    }, { amount: 0.15 })
  }

  const statsContainer = document.querySelector<HTMLElement>('.why-us-stats')
  if (statsContainer) {
    inView(statsContainer, () => {
      const counters = statsContainer.querySelectorAll<HTMLElement>('.countup-num')
      counters.forEach((el) => {
        const target = parseFloat(el.getAttribute('data-target') || '0')

        animate(0, target, {
          duration: 2.2,
          ease: [0.16, 1, 0.3, 1],
          onUpdate: (latest) => {
            el.textContent = Math.round(latest).toString()
          },
        })
      })
    }, { amount: 0.25 })
  }
}

initStickyHeader()
initWhyChooseUsAnimations()
document.addEventListener('astro:page-load', initStickyHeader)
document.addEventListener('astro:page-load', initWhyChooseUsAnimations)
