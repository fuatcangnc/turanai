import settings from './site-settings.json'
import servicesData from './services.json'
import couriers from './couriers.json'

export const siteSettings = settings
export const defaultServices = servicesData.services.map((service) => ({
  ...service,
  url: `/${service.slug}`,
}))
export const serviceCategories = ['Araç Projeleri', 'Dönüşüm', 'Söküm', 'Motosiklet', 'Belgelendirme', 'LPG Söküm Sistemi Tadilatı', 'Motosiklet Taşıma Kutusu Tadilatı', 'Kamyon & Kamyonet Kasa Projeleri', 'Tescil ve Müşavirlik', 'Firma Belgelendirme Hizmetlerimiz', 'Kamyoneti Otomobile Çevirme', 'Engelli Aparatları Çözümleri'] as const
export const courierCompanies = couriers

export type Service = (typeof defaultServices)[number]
export type Courier = (typeof courierCompanies)[number]

export const phoneHref = `tel:${siteSettings.phone.replace(/\D/g, '')}`
export const whatsappHref = (message = 'Hallo, ich möchte Informationen zum Projekt und zum TSE-Zulassungsverfahren für mein Fahrzeug erhalten.') =>
  `https://wa.me/${siteSettings.whatsapp}?text=${encodeURIComponent(message)}`
