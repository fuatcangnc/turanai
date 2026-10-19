import fs from 'fs';
import path from 'path';

const courierCompanies = [
  {
    brand: 'Getir Yemek',
    deliveryFocus: 'yoğun şehir içi yemek teslimatı',
    equipment: 'paket servis çantası, arka taşıma kutusu ve yemek sepeti',
    reviewFocus: 'teslimat çantasının ölçüleri, taşıyıcı bağlantıları ve motosiklet üzerindeki konumu',
    slug: 'getir-yemek-motosiklet-canta-tasima-kutusu-ruhsata-isletme',
    profileLabel: 'Restoran sipariş teslimatları',
    profileSummary: 'Getir Yemek, restoran siparişlerinin şehir içinde hızlı ulaştırılmasına odaklanan teslimat hizmetidir. Isı korumalı çanta ve arka taşıma kutusu kullanımı, sıcak ürün akışına uygun olsa da ekipmanın motosiklete nasıl bağlandığı teknik değerlendirmede belirleyicidir.',
    contextText: 'Getir Yemek teslimatlarında kullanılan paket servis çantası ve arka taşıma kutusunun motosikletle uyumu birlikte değerlendirilir.'
  },
  {
    brand: 'Getir',
    deliveryFocus: 'hızlı market ve sipariş teslimatı',
    equipment: 'kurye kutusu, arka taşıma kasası ve paket ekipmanları',
    reviewFocus: 'sık dur-kalk kullanımında kutunun montaj güvenliği ve araçla teknik uyumu',
    slug: 'getir-motosiklet-canta-tasima-kutusu-ruhsata-isletme',
    profileLabel: 'Hızlı market teslimatı',
    profileSummary: 'Getir, hızlı şehir içi market ve günlük ihtiyaç teslimatlarıyla tanınan bir platform modelidir. Sık dur-kalk yapılan bu kullanımda kurye kutusunun güvenli sabitlenmesi ve motosikletin taşıyıcı yapısıyla uyumu öncelikli kontrol başlıklarıdır.',
    contextText: 'Getir kuryelerinde hızlı market teslimatına eşlik eden kutu ve paket ekipmanlarının montaj düzeni önem taşır.'
  },
  {
    brand: 'Getir Büyük',
    deliveryFocus: 'hacimli market siparişi taşımacılığı',
    equipment: 'büyük hacimli taşıma kutusu, arka kasa ve sabitleme aparatları',
    reviewFocus: 'ekipman hacmi, taşıma dengesi ve montaj noktalarının teknik değerlendirmesi',
    slug: 'getir-buyuk-motosiklet-canta-tasima-kutusu-ruhsata-isletme',
    profileLabel: 'Hacimli market teslimatları',
    profileSummary: 'Getir Büyük, daha geniş market sepetleri ve çoklu ürün siparişleri için kullanılan teslimat modelini temsil eder. Büyük hacimli arka kasa tercih edildiğinde yük dağılımı, taşıma dengesi ve bağlantı aparatlarının araçla uyumu özellikle önemlidir.',
    contextText: 'Getir Büyük için hacimli market siparişlerinde kullanılan büyük kutu ve arka kasa düzeni, taşıma dengesine göre incelenir.'
  },
  {
    brand: 'Yemek Sepeti',
    deliveryFocus: 'restoran ve paket servis teslimatları',
    equipment: 'markalı teslimat çantası, arka kutu ve yemek taşıma sepeti',
    reviewFocus: 'teslimat ekipmanının araçla bağlantısı ve kullanım amacına uygunluğu',
    slug: 'yemek-sepeti-motosiklet-canta-tasima-kutusu-ruhsata-isletme',
    profileLabel: 'Restoran ve market sipariş ağı',
    profileSummary: 'Yemek Sepeti, restoran ve market siparişlerini kullanıcılarla buluşturan dijital sipariş platformlarından biridir. Kurye çantasının ya da arka kutunun sıcak ürün ve günlük teslimat kullanımı için motosiklete nasıl bağlandığı proje kapsamını etkiler.',
    contextText: 'Yemek Sepeti kuryelerinde restoran teslimatında kullanılan arka çanta ve taşıma kutusunun araçla ilişkisi değerlendirilir.'
  },
  {
    brand: 'Trendyol',
    deliveryFocus: 'şehir içi e-ticaret paket teslimatı',
    equipment: 'kargo çantası, motosiklet kasası ve teslimat kutusu',
    reviewFocus: 'paket hacmine göre kutu seçimi, sabitleme sistemi ve kullanım kapsamı',
    slug: 'trendyol-motosiklet-canta-tasima-kutusu-ruhsata-isletme',
    profileLabel: 'E-ticaret paket teslimatı',
    profileSummary: 'Trendyol, Türkiye merkezli e-ticaret platformu olarak farklı boyutlardaki ürünlerin teslimatına yönelik geniş bir ekosisteme sahiptir. Motosikletli teslimatta kargo çantası veya kasa kullanılıyorsa, paket hacmi ve sabitleme noktaları teknik proje açısından önem taşır.',
    contextText: 'Trendyol e-ticaret teslimatlarında kullanılan kargo çantası ve motosiklet kasasının hacmi ile bağlantısı ele alınır.'
  },
  {
    brand: 'Trendyol Yemek',
    deliveryFocus: 'sıcak yemek ve hızlı sipariş teslimatı',
    equipment: 'ısı korumalı yemek çantası, arka taşıma kutusu ve paket servis kasası',
    reviewFocus: 'ısı korumalı ekipmanın montaj şekli ile taşıma sisteminin güvenli yerleşimi',
    slug: 'trendyol-yemek-motosiklet-canta-tasima-kutusu-ruhsata-isletme',
    profileLabel: 'Restoranlardan hızlı yemek teslimatı',
    profileSummary: 'Trendyol Yemek, restoran ve kullanıcıları dijital sipariş akışında buluşturan yemek teslimat hizmetidir. Isı korumalı çanta, arka taşıma kutusu ve paket servis kasasının motosiklete güvenli yerleşimi; sıcak ürün operasyonunda önemli bir teknik başlıktır.',
    contextText: 'Trendyol Yemek kuryelerinde restoran siparişlerini taşımaya yönelik ısı korumalı çanta ve arka kutu uygulamaları değerlendirilir.'
  },
  {
    brand: 'Trendyol Go',
    deliveryFocus: 'esnek kurye ve çoklu sipariş teslimatı',
    equipment: 'kurye çantası, topcase ve taşıma platformu',
    reviewFocus: 'farklı teslimat türlerinde kullanılan ekipmanların ölçü ve bağlantı uyumu',
    slug: 'trendyol-go-motosiklet-canta-tasima-kutusu-ruhsata-isletme',
    profileLabel: 'Esnek ve çoklu teslimat',
    profileSummary: 'Trendyol Go, farklı ürün gruplarının şehir içinde hızlı ulaştırılmasına yönelik teslimat akışlarıyla ilişkilendirilen bir markadır. Teslimat türü değiştikçe kullanılan kurye kutusunun hacmi, montaj sistemi ve motosikletle teknik uyumu da yeniden değerlendirilmelidir.',
    contextText: 'Trendyol Go gönderilerinde farklı paket tiplerine uyum sağlayan kurye kutusunun montaj yapısı değerlendirilir.'
  },
  {
    brand: 'Tıkla Gelsin',
    deliveryFocus: 'restoran odaklı yemek siparişi dağıtımı',
    equipment: 'paket servis çantası, yemek kutusu ve motosiklet arka kasası',
    reviewFocus: 'gıda teslimatında kullanılan kutunun montajı ve taşıma kapasitesi',
    slug: 'tikla-gelsin-motosiklet-canta-tasima-kutusu-ruhsata-isletme',
    profileLabel: 'Restoran odaklı sipariş platformu',
    profileSummary: 'Tıkla Gelsin, restoran siparişlerini dijital kanaldan yöneten ve paket teslimatını destekleyen bir hizmet modelidir. Sıcak ürün taşımada kullanılan çanta veya kutunun kapasitesi kadar, motosiklet üzerindeki güvenli sabitlenmesi de önemlidir.',
    contextText: 'Tıkla Gelsin restoran siparişlerinde paket servis çantasının taşıyıcı bağlantıları ve kullanım düzeni öne çıkar.'
  },
  {
    brand: 'Yemeksepeti Express',
    deliveryFocus: 'market ve hızlı teslimat operasyonu',
    equipment: 'express teslimat kutusu, arka çanta ve kurye taşıma aparatı',
    reviewFocus: 'teslimat kutusunun yoğun kullanımda araçla uyumlu ve güvenli konumlandırılması',
    slug: 'yemeksepeti-express-motosiklet-canta-tasima-kutusu-ruhsata-isletme',
    profileLabel: 'Hızlı market ve teslimat servisi',
    profileSummary: 'Yemeksepeti Express, hızlı market ve günlük ihtiyaç ürünlerinin teslimatına yönelik bir hizmet modelidir. Yoğun şehir içi kullanımda express teslimat kutusunun ağırlık dağılımı, ölçüsü ve arka taşıyıcıya montajı teknik değerlendirmede öne çıkar.',
    contextText: 'Yemeksepeti Express teslimatlarında kullanılan hızlı teslimat ekipmanının montaj ve taşıma düzeni ele alınır.'
  },
  {
    brand: 'Tıklagelsin',
    deliveryFocus: 'hızlı yemek teslimat hizmeti',
    equipment: 'paket taşıma çantası, arka kutu ve servis kasası',
    reviewFocus: 'motosikletin arka taşıyıcı yapısı ile ekipmanın montaj bütünlüğü',
    slug: 'tiklagelsin-motosiklet-canta-tasima-kutusu-ruhsata-isletme',
    profileLabel: 'Hızlı yemek siparişi akışı',
    profileSummary: 'Tıklagelsin adıyla anılan hızlı yemek teslimatı akışında paket servis çantası yoğun kullanıma maruz kalır. Çantanın veya arka kasanın taşıyıcıyla bağlantısı, motosikletin modeli ve mevcut aparatlar göz önünde bulundurularak incelenir.',
    contextText: 'Tıklagelsin için kullanılan sıcak teslimat ekipmanının motosikletle ilişkisi, ekipmanın türüne göre incelenir.'
  },
  {
    brand: 'Zomato',
    deliveryFocus: 'restoran siparişi ve paket teslimatı',
    equipment: 'teslimat çantası, arka taşıma kasası ve topcase',
    reviewFocus: 'ekipmanın araç üzerinde oluşturduğu ölçüsel ve bağlantısal değişiklikler',
    slug: 'zomato-motosiklet-canta-tasima-kutusu-ruhsata-isletme-rehberi',
    profileLabel: 'Restoran keşfi ve yemek siparişi',
    profileSummary: 'Zomato, restoran keşfi ve yemek siparişi alanında bilinen dijital platformlardan biridir. Teslimatta kullanılan arka taşıma kasası veya yemek çantası için teknik yaklaşım; platform isminden bağımsız olarak ekipmanın ölçüsü, montajı ve motosiklet uyumuna dayanır.',
    contextText: 'Zomato sipariş akışında kullanılan yemek teslimat ekipmanının türü ve motosikletle bağlantısı birlikte incelenir.'
  },
  {
    brand: 'Acıkınca',
    deliveryFocus: 'yerel restoran siparişlerinin dağıtımı',
    equipment: 'yemek taşıma çantası, motosiklet kutusu ve paket sepeti',
    reviewFocus: 'farklı marka ve ölçüdeki çantaların motosiklete güvenli sabitlenmesi',
    slug: 'acikinca-motosiklet-canta-tasima-kutusu-ruhsata-isletme',
    profileLabel: 'Yerel restoran teslimat modeli',
    profileSummary: 'Acıkınca, restoran siparişlerini mahalle ve ilçe ölçeğinde ulaştırmaya odaklanan teslimat modelleri için anılan bir platform adıdır. Bu kullanımda çanta ya da kutunun ölçüsü, sıcak ürünlerin düzenli taşınması ve motosikletteki sabitleme düzeni birlikte ele alınır.',
    contextText: 'Acıkınca teslimatlarında kullanılan taşıma ekipmanının hacmi, yerleşimi ve kullanım düzeni teknik açıdan birlikte ele alınır.'
  },
  {
    brand: 'Yettim',
    deliveryFocus: 'kısa mesafe kurye ve hızlı sipariş hizmeti',
    equipment: 'kurye kutusu, arka çanta ve teslimat ekipmanları',
    reviewFocus: 'günlük kullanım yoğunluğuna göre montajın teknik kontrolü',
    slug: 'yettim-motosiklet-canta-tasima-kutusu-ruhsata-isletme',
    profileLabel: 'Kısa mesafeli hızlı teslimat',
    profileSummary: 'Yettim, kısa mesafeli ve hızlı sipariş teslimatıyla ilişkilendirilen bir kurye hizmeti adıdır. Günlük teslimat yoğunluğunda kullanılan çanta ve kutu sisteminin motosikletle bağlantısı, güvenli kullanım için ekipman özelinde incelenmelidir.',
    contextText: 'Yettim kuryelerinin kullandığı taşıma kutusu ve çanta sistemleri, motosiklet üzerindeki uygulamasına göre değerlendirilir.'
  },
  {
    brand: 'Yemekumbara',
    deliveryFocus: 'yemek siparişi ve paket servis teslimatı',
    equipment: 'paket servis çantası, taşıma kutusu ve arka kasa',
    reviewFocus: 'ekipmanın motosiklet modeliyle birlikte ölçü, denge ve bağlantı açısından incelenmesi',
    slug: 'yemekumbara-motosiklet-canta-tasima-kutusu-ruhsata-isletme',
    profileLabel: 'Paket servis organizasyonu',
    profileSummary: 'Yemekumbara, yemek siparişi ve paket servis süreçleri için kullanılan dijital teslimat kanallarından biri olarak anılır. Farklı restoran paketlerinin taşındığı uygulamalarda çantanın hacmi, dengesi ve motosikletteki bağlantısı birlikte kontrol edilir.',
    contextText: 'Yemekumbara teslimatlarında kullanılan paket çantası ve motosiklet kasası, operasyon tipine göre incelenir.'
  },
  {
    brand: 'Doyurunbeni.com',
    deliveryFocus: 'restoran ve mahalle bazlı sipariş teslimatı',
    equipment: 'servis çantası, motosiklet topcase ve taşıma platformu',
    reviewFocus: 'kullanılan taşıma sisteminin montaj noktaları ve araç üzerindeki etkisi',
    slug: 'doyurunbeni-com-motosiklet-canta-tasima-kutusu-ruhsata-isletme',
    profileLabel: 'Mahalle ve restoran siparişleri',
    profileSummary: 'Doyurunbeni.com adı, restoranlar ile yakın çevredeki müşterileri buluşturan yemek siparişi akışını ifade eder. Teslimatta kullanılan servis çantası, topcase veya taşıma platformu; sipariş hacmi ve motosikletteki montaj şekline göre ayrı ayrı incelenmelidir.',
    contextText: 'Doyurunbeni.com sipariş akışında kullanılan paket ekipmanının motosiklet üzerindeki konumu teknik kapsamı belirler.'
  },
  {
    brand: 'Rezzta',
    deliveryFocus: 'online sipariş ve paket dağıtımı',
    equipment: 'kurye çantası, arka taşıma kutusu ve paket kasası',
    reviewFocus: 'çanta-kasa kombinasyonunun motosiklet şasisi ve taşıyıcıyla uyumu',
    slug: 'rezzta-motosiklet-canta-tasima-kutusu-ruhsata-isletme-rehberi',
    profileLabel: 'Dijital sipariş ve paket dağıtımı',
    profileSummary: 'Rezzta, online siparişlerin işletmelerden müşterilere ulaştırıldığı dijital paket dağıtım modelleri arasında anılır. Kurye çantası ve arka kasa birlikte kullanılıyorsa, montaj noktaları ile motosiklet şasisi ve taşıyıcısının uyumu kontrol edilmelidir.',
    contextText: 'Rezzta teslimatlarında kullanılan taşıma çantası ve motosiklet kasasının yerleşimi araç özelinde değerlendirilir.'
  },
  {
    brand: "Domino's",
    deliveryFocus: 'pizza ve sıcak yemek teslimatı',
    equipment: 'ısı korumalı pizza çantası, arka kutu ve servis kasası',
    reviewFocus: 'geniş hacimli sıcak yemek çantasının sabitleme ve denge koşulları',
    slug: 'dominos-motosiklet-canta-tasima-kutusu-ruhsata-isletme',
    profileLabel: 'Sıcak pizza teslimatları',
    profileSummary: "Domino's, sıcak pizza ve yan ürünlerin hızlı teslimatına odaklanan restoran zinciri modelinin bilinen örneklerinden biridir. Geniş tabanlı ısı korumalı çanta veya kasa kullanıldığında, ekipmanın motosiklet üzerinde kapladığı alan ve montajı teknik açıdan değerlendirilir.",
    contextText: "Domino's teslimatlarında kullanılan geniş hacimli sıcak teslimat çantalarının montajı ve araçla ilişkisi ayrı değerlendirilir."
  },
  {
    brand: 'Paket Taxi',
    deliveryFocus: 'çoklu işletme için kurye taşımacılığı',
    equipment: 'modüler taşıma çantası, teslimat kutusu ve arka kasa',
    reviewFocus: 'farklı paket tipleri için kullanılan ekipmanın teknik yerleşimi',
    slug: 'paket-taxi-motosiklet-canta-tasima-kutusu-ruhsata-isletme',
    profileLabel: 'Çoklu işletme teslimat ağı',
    profileSummary: 'Paket Taxi tarzı kurye ağlarında bir motosiklet farklı işletmelerin paketlerini gün içinde taşıyabilir. Modüler çanta ve teslimat kutusu kullanıldığında, ekipmanın seçimi ile aracın arka taşıyıcısındaki bağlantı düzeni teknik açıdan önemlidir.',
    contextText: 'Paket Taxi tarzı hızlı gönderi taşımalarında kullanılan ekipmanın sabitlenmesi ve kullanım amacı birlikte ele alınır.'
  },
  {
    brand: 'Migros Kurye',
    deliveryFocus: 'market siparişi ve günlük ihtiyaç teslimatı',
    equipment: 'market taşıma kutusu, arka kasa ve hacimli kurye çantası',
    reviewFocus: 'market siparişlerinin ağırlık ve hacmine uygun taşıma sisteminin değerlendirilmesi',
    slug: 'migros-kurye-motosiklet-canta-tasima-kutusu-ruhsata-isletme',
    profileLabel: 'Market alışverişi teslimatı',
    profileSummary: 'Migros Kurye, market alışverişlerinin müşterilere ulaştırıldığı teslimat akışını ifade eder. Günlük ihtiyaç ürünlerinde hacim ve ağırlık değişebildiğinden, market kutusunun taşıma dengesi ile motosikletteki montaj biçimi birlikte değerlendirilir.',
    contextText: 'Migros Kurye teslimatlarında market siparişlerine uygun taşıma kutusunun hacmi ve montaj yöntemi önemlidir.'
  },
  {
    brand: 'Migros Sanalmarket',
    deliveryFocus: 'sanal market siparişi teslimatı',
    equipment: 'market kutusu, taşıma kasası ve kurye arka çantası',
    reviewFocus: 'yük dağılımı, ekipman ölçüsü ve motosiklet üzerindeki sabitleme düzeni',
    slug: 'migros-sanalmarket-motosiklet-canta-tasima-kutusu-ruhsata-isletme-rehberi',
    profileLabel: 'Sanal market siparişleri',
    profileSummary: 'Migros Sanalmarket, online market sepetlerinin planlı teslimatına odaklanan bir alışveriş kanalıdır. Market ürünleri için kullanılan arka kasa veya çantada yük dağılımı, hacim ve taşıyıcı bağlantısının araçla uyumu önem taşır.',
    contextText: 'Migros Sanalmarket siparişlerinde kullanılan taşıma ekipmanları, market ürünlerinin düzenli taşınmasına göre ele alınır.'
  },
  {
    brand: 'Uber Eats',
    deliveryFocus: 'restoran siparişi ve esnek kurye teslimatı',
    equipment: 'motosiklet teslimat çantası, topcase ve taşıma kutusu',
    reviewFocus: 'farklı restoran siparişleri için kullanılan ekipmanın teknik uygunluk kontrolü',
    slug: 'uber-eats-motosiklet-canta-tasima-kutusu-ruhsata-isletme-rehberi',
    profileLabel: 'Uygulama tabanlı restoran teslimatı',
    profileSummary: 'Uber Eats, uygulama üzerinden restoran siparişlerinin teslimatına odaklanan küresel bir yemek platformu olarak bilinir. Yerel kurye uygulamalarında kullanılan çanta veya topcase için inceleme, markadan bağımsız şekilde ekipmanın motosikletteki gerçek montajına göre yapılır.',
    contextText: 'Uber Eats teslimatlarında kullanılan yemek çantası veya kutunun motosikletle bağlantısı, mevcut ekipmana göre incelenir.'
  },
  {
    brand: 'Vigo',
    deliveryFocus: 'şehir içi lojistik ve hızlı teslimat operasyonu',
    equipment: 'lojistik taşıma kutusu, arka çanta ve motosiklet kasası',
    reviewFocus: 'operasyonel kullanımda kutu bağlantılarının dayanımı ve araçla uyumu',
    slug: 'vigo-motosiklet-canta-tasima-kutusu-ruhsata-isletme-rehberi',
    profileLabel: 'Şehir içi lojistik teslimatı',
    profileSummary: 'Vigo, şehir içi lojistik ve son kilometre teslimat ihtiyaçlarına odaklanan kurye operasyonlarıyla bilinen bir markadır. Çoklu teslimat rotalarında kullanılan taşıma kutusunun dayanımı, hacmi ve motosikletteki sabitlemesi teknik açıdan değerlendirilir.',
    contextText: 'Vigo kuryelerinde çoklu teslimat akışına eşlik eden taşıma sisteminin konumu ve sabitlemesi önem taşır.'
  },
  {
    brand: 'Bi Şey Kurye',
    deliveryFocus: 'bireysel ve kurumsal hızlı kurye hizmeti',
    equipment: 'kurye kasası, arka taşıma çantası ve teslimat kutusu',
    reviewFocus: 'kurye ekipmanının kullanım şekline göre teknik proje kapsamı',
    slug: 'bi-sey-kurye-motosiklet-canta-tasima-kutusu-ruhsata-isletme',
    profileLabel: 'Çok noktalı kurye modeli',
    profileSummary: 'Bi Şey Kurye adıyla yürütülen çok noktalı teslimat işlerinde aynı motosiklet gün içinde farklı paket türleri taşıyabilir. Bu nedenle ekipmanın yalnızca hacmi değil, taşıyıcıya bağlandığı noktalar ve günlük kullanımdaki dengesi de önem kazanır.',
    contextText: 'Bi Şey Kurye benzeri çok noktalı teslimat akışlarında, kutunun sabitlenmesi ve motosikletle dengesi öne çıkar.'
  },
  {
    brand: 'Moto Kurye',
    deliveryFocus: 'bağımsız moto kurye taşımacılığı',
    equipment: 'motosiklet çantası, yan çanta, topcase ve taşıma sepeti',
    reviewFocus: 'birden fazla taşıma ekipmanının motosiklet üzerindeki toplam etkisi',
    slug: 'moto-kurye-motosiklet-canta-tasima-kutusu-ruhsata-isletme',
    profileLabel: 'Bağımsız moto kurye kullanımı',
    profileSummary: 'Moto kurye hizmeti tek bir platforma bağlı olmayan; evrak, paket, yemek veya e-ticaret gönderilerinin motosikletle taşındığı geniş bir çalışma alanıdır. Yan çanta, topcase ve sepet gibi birden fazla ekipman varsa teknik kapsam bütün olarak ele alınmalıdır.',
    contextText: 'Moto kurye hizmetlerinde evrak, paket veya ürün taşımaya göre seçilen kutunun bağlantı biçimi teknik incelemeyi etkiler.'
  },
  {
    brand: 'Paket Servis',
    deliveryFocus: 'restoran, kafe ve işletme teslimatları',
    equipment: 'paket servis kutusu, arka kasa ve yemek çantası',
    reviewFocus: 'işletmeye ait ekipmanın motosiklete montaj biçimi ve teknik kontrolü',
    slug: 'paket-servis-motosiklet-canta-tasima-kutusu-ruhsata-isletme-rehberi',
    profileLabel: 'İşletme bazlı paket servis',
    profileSummary: 'Paket servis, restoran, kafe veya mağazanın kendi teslimat organizasyonuyla müşterilerine ulaşmasını ifade eder. İşletmeye ait logo kaplamalı kutu ya da servis çantasının motosiklete montajı, kullanım amacı ve ölçüleriyle birlikte değerlendirilir.',
    contextText: 'Paket servis kullanımında çanta ve kasanın tipi, teslimat ürününün niteliğiyle birlikte değerlendirilir.'
  },
  {
    brand: 'Hızır Paket',
    deliveryFocus: 'hızlı kurye ve anlık sipariş teslimatı',
    equipment: 'hızlı teslimat çantası, arka kutu ve taşıma kasası',
    reviewFocus: 'yoğun teslimat döngüsünde kullanılan ekipmanın güvenli montajı',
    slug: 'hizir-paket-motosiklet-canta-tasima-kutusu-ruhsata-isletme',
    profileLabel: 'Anlık teslimat akışı',
    profileSummary: 'Hızır Paket, zaman hassasiyetinin yüksek olduğu hızlı kurye hizmetleri için kullanılan bir marka adıdır. Kısa teslimat döngülerinde ekipman sık kullanıldığı için kutu bağlantılarının dayanımı ve güvenli yerleşimi dikkatle kontrol edilir.',
    contextText: 'Hızır Paket operasyonlarında zaman odaklı teslimat için kullanılan taşıma çözümünün bağlantı yapısı öne çıkar.'
  },
  {
    brand: 'Jetbee',
    deliveryFocus: 'şehir içi kurye ve e-ticaret teslimatı',
    equipment: 'kargo çantası, motosiklet taşıma kutusu ve arka platform',
    reviewFocus: 'e-ticaret paketlerine göre seçilen kutunun ölçü ve bağlantı uygunluğu',
    slug: 'jetbee-motosiklet-canta-tasima-kutusu-ruhsata-isletme',
    profileLabel: 'E-ticaret ve şehir içi kurye',
    profileSummary: 'Jetbee benzeri şehir içi e-ticaret teslimatlarında paket boyutları gün içinde değişebilir. Bu değişken kullanım, kargo çantasının veya arka kutunun hem hacim hem de motosiklet taşıyıcısına bağlantı bakımından değerlendirilmesini gerektirir.',
    contextText: 'Jetbee teslimatlarında kullanılan kurye kutusu ve aksesuarların motosiklet üzerindeki yerleşimi değerlendirilir.'
  }
];

const targetDir = path.join(process.cwd(), 'src/content/couriers');
if (!fs.existsSync(targetDir)) {
  fs.mkdirSync(targetDir, { recursive: true });
}

for (const company of courierCompanies) {
  const faqs = [
    {
      question: `${company.brand} motosiklet çantayı ruhsata işletmek kaç TL?`,
      answer: `${company.brand} için kullanılan ekipmanın ruhsata işletme bedeli; motosiklet modeli, ${company.equipment} türü, montaj yapısı ve ihtiyaç duyulan teknik işlem kapsamına göre değişir. Net ücret için ruhsat, ekipman bilgisi ve fotoğraflar üzerinden ön değerlendirme yapılır.`
    },
    {
      question: `${company.brand} motosiklet çantası ruhsata nasıl işletilir?`,
      answer: `${company.brand} kuryesinin kullandığı ekipman için önce ${company.reviewFocus} değerlendirilir. Ardından gerekli teknik proje, uygunluk kontrolü, muayene ve tescil adımları aracın durumuna göre planlanır.`
    },
    {
      question: `${company.brand} kuryelerinde motosiklet yan çanta da değerlendirilir mi?`,
      answer: `Yan çanta, topcase veya ek taşıma ekipmanının değerlendirilmesi; ürünün niteliği, montaj noktaları ve motosiklet üzerindeki etkisine göre yapılır. ${company.brand} operasyonunda kullanılan tüm ekipmanları birlikte paylaşmanız doğru proje kapsamının belirlenmesini sağlar.`
    },
    {
      question: `${company.brand} kurye ekipmanını ruhsata işletmek zorunlu mu?`,
      answer: `Ruhsata işletme ihtiyacı, ekipmanın motosiklete uygulanış biçimi ile teknik ve tescil kapsamına göre belirlenir. ${company.brand} için kullanılan taşıma sisteminin güncel durumunu teknik incelemeyle netleştirmek, işlem öncesinde doğru yolun belirlenmesine yardımcı olur.`
    }
  ];

  const data = {
    title: `${company.brand} Motosiklet Çanta (Taşıma Kutusu) Ruhsata İşletme Rehberi`,
    brand: company.brand,
    slug: company.slug,
    deliveryFocus: company.deliveryFocus,
    equipment: company.equipment,
    reviewFocus: company.reviewFocus,
    profileLabel: company.profileLabel,
    profileSummary: company.profileSummary,
    contextText: company.contextText,
    faqs
  };

  const filePath = path.join(targetDir, `${company.slug}.json`);
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
}

console.log(`Successfully generated ${courierCompanies.length} courier company JSON files in src/content/couriers/`);
