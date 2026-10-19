import { animate, inView, stagger } from 'motion'

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
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
    item.style.opacity = '0'
    item.style.transform = 'translateY(1.25rem)'
    inView(item, () => {
      animate(item, { opacity: 1, y: 0 }, { duration: 0.65, ease: [0.22, 1, 0.36, 1] })
    }, { amount: 0.16 })
  })

  document.querySelectorAll<HTMLElement>('[data-reveal-group]').forEach((group) => {
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
