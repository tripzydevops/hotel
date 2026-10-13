import { GuideArticle } from "./guideData";

export const GUIDE_CATEGORIES_TR = [
  "Tüm Rehberler",
  "Başlarken",
  "Canlı Panel & Grid",
  "6-Sekmeli İnceleme",
  "Piyasa Analizi",
  "Yapay Zeka & Copilot",
  "Parite & Uyarılar",
  "Raporlar & Yönetim",
] as const;

export const CATEGORY_MAP_TR_TO_EN: Record<string, string> = {
  "Tüm Rehberler": "All Guides",
  "Başlarken": "Getting Started",
  "Canlı Panel & Grid": "Dashboard & Grid",
  "6-Sekmeli İnceleme": "Inspection Modal",
  "Piyasa Analizi": "Market Analysis",
  "Yapay Zeka & Copilot": "AI & Copilot",
  "Parite & Uyarılar": "Alerts & Parity",
  "Raporlar & Yönetim": "Reports & Admin",
};

export const GUIDE_ARTICLES_TR: GuideArticle[] = [
  {
    id: "getting-started",
    slug: "getting-started-onboarding",
    title: "Hızlı Başlangıç: HotelPlus'ta İlk 5 Dakikanız",
    subtitle: "Hedef Otelinizi Belirleme, Rakip Sepetleri Oluşturma ve Para Birimlerini Seçme",
    category: "Getting Started",
    readTime: "4 dk okuma",
    iconName: "Compass",
    badge: "Temel",
    summary:
      "HotelPlus'ın temel mimarisini öğrenin. Ana otelinizi (Hedef Tesis) nasıl tanımlayacağınızı, doğrudan rakiplerinizi nasıl seçeceğinizi, döviz kurlarını nasıl yapılandıracağınızı ve ilk canlı piyasa taramanızı nasıl başlatacağınızı keşfedin.",
    video: {
      title: "2 Dakikada HotelPlus: Mimari ve Hızlı Kurulum",
      duration: "02:15",
      embedUrl: "https://www.youtube-nocookie.com/embed/ScMzIvxBSi4",
      previewPoster: "https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=1200&q=80",
      chapters: [
        { time: "00:00", title: "Giriş ve Mimari", description: "Fiyat paritesi ve gerçek zamanlı OTA takibinin önemi." },
        { time: "00:45", title: "Hedef Tesisin Eklenmesi", description: "Google Place ID ve doğrudan web sitesi ile otelinizi tanımlama." },
        { time: "01:20", title: "Rakip Sepetinin Oluşturulması", description: "Şehir ve yıldız kategorisine göre yerel rakipleri ekleme." },
        { time: "01:50", title: "İlk Canlı Tarama & Parite Kontrolü", description: "Tarayıcı görevlerini tetikleme ve fiyat uyarılarını okuma." },
      ],
      keyTakeaways: [
        "Hedef Oteliniz altın taç simgesiyle işaretlenir ve tüm parite hesaplamalarının referansıdır.",
        "Rakipler DataForSEO tarayıcıları ile büyük OTA'lar üzerinden eşzamanlı izlenir.",
        "Dinamik döviz kuru önbelleği, uluslararası fiyatları seçtiğiniz para biriminde birleştirir.",
      ],
    },
    screenMockup: {
      screenType: "dashboard-grid",
      caption: "Ana Google Hotels Canlı İzleme Tablosu: Hedef Otel ve Rakip Kartları",
      hotspots: [
        {
          id: "hs-1",
          pinNumber: 1,
          label: "Hedef Otel Tacı",
          xPercent: 18,
          yPercent: 32,
          title: "Hedef Tesis Rozeti",
          description: "Ana tesisiniz altın çerçeve ve taç simgesiyle vurgulanır. Tüm parite ihlalleri doğrudan fiyatınız baz alınarak hesaplanır.",
          actionRequired: "Doğrudan oda fiyatınızın güncel ve resepsiyonunuzla uyumlu olduğundan emin olun.",
        },
        {
          id: "hs-2",
          pinNumber: 2,
          label: "Canlı Piyasa Nabzı",
          xPercent: 55,
          yPercent: 12,
          title: "Ortalama Piyasa Fiyatı",
          description: "Seçilen giriş tarihi aralığında rakip sepetinizin gerçek zamanlı ortalama oda fiyatı.",
          actionRequired: "Piyasa ortalamasının üstünde mi yoksa altında mı fiyatlandırdığınızı görmek için doğrudan fiyatınızla kıyaslayın.",
        },
        {
          id: "hs-3",
          pinNumber: 3,
          label: "Hızlı Tarama Tetikleyici",
          xPercent: 88,
          yPercent: 12,
          title: "İsteğe Bağlı Hızlı Tarama",
          description: "Google Hotels, Booking.com ve Expedia üzerinden canlı fiyatları anında çekmek için arka plan tarama görevini başlatır.",
          actionRequired: "Rakiplerin gün içi fiyat değiştirdiğinden şüphelendiğinizde tıklayın.",
        },
      ],
    },
    objectives: [
      "Hedef Tesis ile Rakip Sepeti arasındaki farkı ve önemini anlama",
      "Otomatik döviz dönüşümleri ile temel para biriminizi (USD, EUR, GBP, TRY) yapılandırma",
      "İsteğe bağlı piyasa taramalarını başlatma ve tarayıcı durumunu gerçek zamanlı izleme",
    ],
    steps: [
      {
        stepNumber: 1,
        title: "Hedef Otelinizi Belirleyin veya Ekleyin",
        description:
          "Üst gezinme çubuğundaki '+ Otel Ekle' butonuna tıklayın. Otelinizin resmi adını veya Google Place ID'sini girin. 'Birincil Hedef Otel Olarak Ayarla' anahtarını açın.",
        tip: "Hedef oteli belirlemek, tüm analiz sekmelerinde otomatik parite farkı hesaplamalarını ve uyarıları aktif eder.",
      },
      {
        stepNumber: 2,
        title: "Rakip Sepetinizi Doldurun",
        description:
          "Yakın alt bölgenizdeki veya aynı segmentteki 3 ila 10 oteli ekleyin. Rakipleri otomatik tespit etmek için Yapay Zeka Keşif Motorunu (/analysis/discovery) da kullanabilirsiniz.",
        tip: "Doğru piyasa nabzı verileri için rakipleri aynı coğrafi alt bölgede (örn. Taksim, İstanbul) tutun.",
      },
      {
        stepNumber: 3,
        title: "Görüntüleme Para Biriminizi Seçin",
        description:
          "USD, EUR, GBP veya TRY arasında geçiş yapmak için üst menüdeki para birimi açılır kutusunu kullanın.",
      },
      {
        stepNumber: 4,
        title: "İlk Temel Piyasa Taramanızı Başlatın",
        description:
          "'Tüm Otelleri Tara' butonuna tıklayın. Fiyatlar ve OTA oda katalogları toplanırken çalışan aşamalarını canlı izleyin.",
      },
    ],
    deepDiveSections: [
      {
        heading: "HotelPlus 'Soğuk Başlangıç' (Cold Start) Sorununu Nasıl Çözer?",
        content:
          "Fiyatlandırma tavsiyesi sunmadan önce aylarca geçmiş rezervasyon verisi yüklemesi gerektiren eski gelir yönetimi sistemlerinin aksine, HotelPlus otonom yapay zeka ajanları ve vektör gömmeleri (pgvector) kullanır. Sistem, ilk günden itibaren rakip olanaklarını, canlı misafir yorumu duygularını ve fiyat hızını analiz eder.",
        highlights: [
          "Gemini 3.1 Pro destekli sıfır geçmişli soğuk başlangıç öneri motoru.",
          "Vektör tabanlı anlamsal arama ile misafir beklentilerini karşılayan gerçek rakipleri bulma.",
          "Gerçek zamanlı canlı tarama motoru ile bayat 24 saatlik önbellekleri ortadan kaldırma.",
        ],
      },
    ],
    faqs: [
      {
        question: "Birden fazla Hedef Tesis takip edebilir miyim?",
        answer: "Kurumsal hesaplar, üst otel seçiciden çoklu mülk geçişini destekler. Standart hesaplar bir hedef oteli ve 15'e kadar rakibi izler.",
      },
      {
        question: "Fiyatlar otomatik olarak ne sıklıkla yenilenir?",
        answer: "Arka plan rollupları varsayılan olarak günlük çalışır; ayrıca tarama butonuna tıkladığınız her an anlık tarama yapabilirsiniz.",
      },
    ],
  },
  {
    id: "dashboard-grid",
    slug: "google-hotels-live-dashboard",
    title: "Google Hotels Canlı Takip Paneli & Piyasa Nabzı",
    subtitle: "Canlı fiyat kartları, mini trend grafikleri, parite ihlal rozetleri ve tarayıcı akışları",
    category: "Dashboard & Grid",
    readTime: "5 dk okuma",
    iconName: "LayoutGrid",
    badge: "Temel Özellik",
    summary:
      "Canlı Panel, HotelPlus'ın komuta merkezidir. Google Hotels, Booking.com ve Expedia üzerindeki canlı fiyatları bir araya getirir; fiyat kıran OTA'ları ve rakip dalgalanmalarını anında gösterir.",
    video: {
      title: "Canlı Panel ve Fiyat Kartlarında Uzmanlaşın",
      duration: "03:10",
      embedUrl: "https://www.youtube-nocookie.com/embed/L_LUpnjgPso",
      previewPoster: "https://images.unsplash.com/photo-1551882547-ff40c63fe5fa?auto=format&fit=crop&w=1200&q=80",
      chapters: [
        { time: "00:00", title: "Panel Genel Görünümü & KPI Çubuğu", description: "Piyasa Nabzı, Hedef Fiyat ve İhlal Sayaçlarını Anlama." },
        { time: "01:05", title: "Otel Kartı Anatomisi", description: "Fiyat trendlerini, OTA rozetlerini ve yıldız puanlarını okuma." },
        { time: "01:55", title: "Fiyat Kırma ve Parite Rozetleri", description: "Doğrudan fiyattan ucuza satan kural dışı OTA'ları yakalama." },
        { time: "02:30", title: "Gün İçi Fiyat Hikayeleri & Taramalar", description: "Bugün gerçekleşen fiyat hareketlerini inceleme." },
      ],
      keyTakeaways: [
        "Kırmızı rozetler, bir rakibin veya OTA'nın doğrudan fiyatınızı kırdığını gösterir.",
        "Yeşil rozetler, doğrudan fiyatınızın piyasadaki en iyi teklif olduğunu gösterir.",
        "Herhangi bir kartı tıklamak 6-Sekmeli Derinlemesine İnceleme Modalı'nı açar.",
      ],
    },
    screenMockup: {
      screenType: "dashboard-grid",
      caption: "HotelPlus Canlı Tablo: Hedef Tesis ile Rakip Kartları Karşılaştırması",
      hotspots: [
        {
          id: "hs-tile-price",
          pinNumber: 1,
          label: "Canlı Fiyat ve Değişim",
          xPercent: 24,
          yPercent: 48,
          title: "Mevcut Oda Fiyatı ve 24s Değişim",
          description: "Halka açık en düşük güncel fiyatı gösterir. Yeşil veya kırmızı oklar önceki taramaya göre fiyat hareketini belirtir.",
        },
        {
          id: "hs-tile-ota",
          pinNumber: 2,
          label: "OTA Kanal Rozetleri",
          xPercent: 22,
          yPercent: 68,
          title: "Aktif Satıcı Kanalları",
          description: "Hangi satıcıların (Booking.com, Expedia, Agoda, Doğrudan) aktif olduğunu ve en ucuz teklifi veren satıcıyı gösterir.",
        },
        {
          id: "hs-tile-actions",
          pinNumber: 3,
          label: "Kart Eylemleri & Detay",
          xPercent: 32,
          yPercent: 35,
          title: "Hızlı İnceleme & Düzenleme",
          description: "6 sekmeli modalı açmak için 'Detayları Gör'e tıklayın veya tek otel taraması için tarama simgesini seçin.",
        },
      ],
    },
    objectives: [
      "Üst KPI metriklerini doğru yorumlama: Hedef Fiyat, Piyasa Ortalaması, İhlal Sayısı",
      "Fiyat değişim mini grafiklerini ve 24 saatlik yüzde farklarını okuma",
      "Potansiyel misafirler başka kanaldan rezervasyon yapmadan önce fiyat kıran OTA'ları yakalama",
    ],
    steps: [
      {
        stepNumber: 1,
        title: "Üst Metrik Kartlarını Kontrol Edin",
        description:
          "'Fiyat Kırma' sayısını kontrol edin. 0'dan büyükse en az bir OTA odanızı doğrudan fiyattan ucuza satmaktadır.",
      },
      {
        stepNumber: 2,
        title: "Otel Tablosunu Filtreleyin ve Sıralayın",
        description:
          "Agresif rakip indirimlerini anında görmek için 'Fiyat: Düşükten Yükseğe' veya 'En Çok Fiyat Kırılan' şeklinde sıralayın.",
      },
      {
        stepNumber: 3,
        title: "Mini Trend Grafiklerini İnceleyin",
        description:
          "Her kart, son 7 ila 30 günün fiyat hareketlerini gösteren mini bir tarihsel trend grafiği barındırır.",
      },
    ],
    deepDiveSections: [
      {
        heading: "Parite Motoru Mantığı",
        content:
          "Tarayıcımız Google Hotels'i taradığında DataForSEO'dan gelen teklifler bloğunu çözümler. Resmi Doğrudan otel web sitesi teklifini üçüncü taraf aracılarla (Booking.com, Trip.com, Prestigia vb.) karşılaştırır. Bir OTA 1 dolar bile düşük fiyat yayınlarsa HotelPlus Fiyat Paritesi İhlali uyarısı üretir.",
      },
    ],
    faqs: [
      {
        question: "Bir otel kartında neden 'Tahmini' yazıyor?",
        answer: "Bir rakip seçilen tarihlerde tamamen doluysa HotelPlus en son doğrulanmış fiyat kaydını veya tarihsel özet verisini gösterir.",
      },
    ],
  },
  {
    id: "hotel-inspection",
    slug: "6-tab-hotel-inspection-modal",
    title: "6-Sekmeli Derinlemesine Otel İnceleme Modalı",
    subtitle: "Odalar, OTA kanal teklifleri, misafir yorumları, olanaklar ve görsellerin adli analizi",
    category: "Inspection Modal",
    readTime: "6 dk okuma",
    iconName: "Eye",
    badge: "İleri Düzey",
    summary:
      "Herhangi bir otel kartında 'Detayları Gör'e tıklamak 6-Sekmeli İnceleme Modalı'nı açar. Oda tipleri, kanal fiyat dağılımları, yapay zeka misafir duygu analizi ve olanakları inceler.",
    video: {
      title: "6-Sekmeli Otel İnceleme Modalı'nda Uzmanlaşın",
      duration: "04:00",
      embedUrl: "https://www.youtube-nocookie.com/embed/1la40l03574",
      previewPoster: "https://images.unsplash.com/photo-1582719508461-905c673771fd?auto=format&fit=crop&w=1200&q=80",
      chapters: [
        { time: "00:00", title: "Modal Genel Bakış", description: "Modalı açma ve 6 sekmeyi gezme." },
        { time: "00:50", title: "Sekme 1: Genel Bakış & Konum", description: "GPS koordinatları, telefon, giriş kuralları, yıldız puanı." },
        { time: "01:30", title: "Sekme 2: Odalar & Katalog", description: "Oda tipi eşleştirmeleri (Deluxe, Süit, Standart)." },
        { time: "02:20", title: "Sekme 3: Teklifler & OTA Kanalları", description: "Tüm OTA'lardan yan yana fiyatlar." },
        { time: "03:10", title: "Sekme 4: Misafir Duygusu & Yorumlar", description: "Yapay zeka yorum analizi ve konu duygu dağılımı." },
        { time: "03:45", title: "Sekmeler 5 & 6: Olanaklar & Galeri", description: "Olanak kıyaslaması ve yüksek çözünürlüklü görseller." },
      ],
      keyTakeaways: [
        "Teklifler sekmesi, fiyat anlaşmalarını ihlal eden OTA'ları yakalamak için ana araçtır.",
        "Yorumlar sekmesi binlerce misafir yorumu üzerinde yapay zeka özetlemesi çalıştırır.",
        "Oda tipleri normalize edilir; böylece Deluxe odayı Standart odayla değil Deluxe ile kıyaslarsınız.",
      ],
    },
    screenMockup: {
      screenType: "hotel-modal",
      caption: "6-Sekmeli Otel Detay Modalı: Oda tipleri ve OTA tekliflerinin dökümü",
      hotspots: [
        {
          id: "hs-tab-nav",
          pinNumber: 1,
          label: "Sekme Gezinme Çubuğu",
          xPercent: 50,
          yPercent: 18,
          title: "6 Özelleştirilmiş Adli Sekme",
          description: "Genel Bakış, Odalar, Teklifler, Yorumlar, Olanaklar ve Galeri arasında kesintisiz geçiş yapın.",
        },
        {
          id: "hs-tab-offers",
          pinNumber: 2,
          label: "OTA Teklif Matrisi",
          xPercent: 35,
          yPercent: 50,
          title: "Çoklu OTA Karşılaştırma Tablosu",
          description: "Fiyatlar, doğrudan rezervasyon bağlantıları ve döviz dönüşümü dahil bu otel için oda satan her satıcıyı listeler.",
        },
        {
          id: "hs-tab-sentiment",
          pinNumber: 3,
          label: "Misafir Memnuniyet Puanı",
          xPercent: 72,
          yPercent: 50,
          title: "Duygu & Konu Radarı",
          description: "Temizlik, Hizmet, Kahvaltı, WiFi ve Konum başlıklarında olumlu/olumsuz yüzdeleriyle misafir yorumlarını analiz eder.",
        },
      ],
    },
    objectives: [
      "Oda tipi fiyat denetimi yapma (OTA'ların Standart odayı sitenizden ucuza listelediğini yakalama)",
      "Yapay zeka duygu analiziyle rakip güçlü ve zayıf yönlerini tespit etme",
      "Rakip olanak paketlerini (ücretsiz kahvaltı, havuz, spa) kendi otelinizle denetleme",
    ],
    steps: [
      {
        stepNumber: 1,
        title: "Herhangi Bir Otel Kartında 'Detayları Gör'e Tıklayın",
        description: "6 sekmeli modal anında açılır ve canlı fiyat kayıtlarını getirir.",
      },
      {
        stepNumber: 2,
        title: "Parite Sızıntısı İçin 'Teklifler' Sekmesini İnceleyin",
        description: "Teklifleri en düşükten en yükseğe sıralayın. Bir OTA resmi siteden düşükse satıcı adını ve fiyat farkını not edin.",
      },
      {
        stepNumber: 3,
        title: "Duygu Madenciliği İçin 'Yorumlar' Sekmesine Geçin",
        description: "Rakiplerin en çok şikayet aldığı konuları (örn. sokak gürültüsü, yavaş giriş) tespit edip kendi otelinizin zıt avantajlarını öne çıkarın.",
      },
    ],
    deepDiveSections: [
      {
        heading: "Granüler Tekilleştirme Algoritması",
        content:
          "HotelPlus, aynı satıcının meşru çoklu oda tipi tekliflerini korurken tablonun kirlenmesini önlemek için `{kaynak}_{oda_tipi}_{fiyat}` bileşik anahtarını kullanır.",
      },
    ],
    faqs: [
      {
        question: "Fiyatı doğrulamak için OTA bağlantılarına tıklayabilir miyim?",
        answer: "Evet, herhangi bir satıcının yanındaki dış bağlantı simgesine tıklamak anında doğrulama için ilgili OTA sayfasına yönlendirir.",
      },
    ],
  },
  {
    id: "rate-calendar",
    slug: "30-day-rate-calendar-matrix",
    title: "30-Günlük Fiyat Takvim Matrisi",
    subtitle: "Makro fiyatlandırma takvimi, rakip ileriye dönük fiyat eğrileri ve talep artış göstergeleri",
    category: "Market Analysis",
    readTime: "5 dk okuma",
    iconName: "Calendar",
    badge: "Gelir Yönetimi",
    summary:
      "Fiyat Takvimi (/analysis/calendar), sonraki 30 ila 90 günün günlük fiyatlarını haritalandırır. Rakiplerin fiyat artırdığı veya oda boşalttığı günleri anında tespit edin.",
    video: {
      title: "30-Günlük Fiyat Takviminde Uzmanlaşın",
      duration: "02:45",
      embedUrl: "https://www.youtube-nocookie.com/embed/V-_O7nl0Ii0",
      previewPoster: "https://images.unsplash.com/photo-1506059612708-99d6c258160e?auto=format&fit=crop&w=1200&q=80",
      chapters: [
        { time: "00:00", title: "Takvim Arayüz Turu", description: "Tarih ızgarası ve fiyat ısı haritalarını anlama." },
        { time: "00:45", title: "Hedef ve Piyasa Farkı", description: "İleriye dönük fiyatlandırma farklarını görselleştirme." },
        { time: "01:30", title: "Oda Tiplerini Filtreleme", description: "Süitleri standart giriş odalarından ayırma." },
        { time: "02:10", title: "Yüksek Talep Tarihlerini Belirleme", description: "Tatil ve yerel etkinlik fiyat sıçramalarını yakalama." },
      ],
      keyTakeaways: [
        "Renk ısı haritaları, fiyatınızın piyasa ortalamasından saptığı günleri anında vurgular.",
        "İleriye dönük taramalar, yüksek talep etkinliklerinde erken ve ucuza dolmanızı önler.",
      ],
    },
    screenMockup: {
      screenType: "rate-calendar",
      caption: "İnteraktif Fiyat Takvim Matrisi: Günlük rakip fiyat karşılaştırması",
      hotspots: [
        {
          id: "hs-cal-header",
          pinNumber: 1,
          label: "Tarih Aralığı & Filtreler",
          xPercent: 30,
          yPercent: 15,
          title: "Tarih Aralığı Seçici",
          description: "7 günlük, 14 günlük ve 30 günlük ileriye dönük görünümler arasında geçiş yapın.",
        },
        {
          id: "hs-cal-cells",
          pinNumber: 2,
          label: "Günlük Fiyat Matrisi",
          xPercent: 50,
          yPercent: 45,
          title: "Fiyat Farkı Isı Haritası",
          description: "Her hücre fiyatınızı rakip ortalamasıyla karşılaştırır. Kırmızı çerçeveler rakiplerin sizden ucuz olduğu günleri gösterir.",
        },
      ],
    },
    objectives: [
      "30 güne kadar ileriye dönük fiyatlandırma trendlerini inceleme",
      "Rakip sıkışma tarihlerini (rakiplerin dolduğu veya fiyatı sert artırdığı günleri) tespit etme",
      "Doğrudan fiyatlandırmanızı piyasa talep döngüleriyle uyumlu hale getirme",
    ],
    steps: [
      {
        stepNumber: 1,
        title: "Tarih Pencerenizi Seçin",
        description: "`/analysis/calendar` sayfasının üstündeki takvim kontrollerini kullanarak giriş tarihlerini seçin.",
      },
      {
        stepNumber: 2,
        title: "Günlük Farkı Analiz Edin",
        description: "Günlük satırınızı piyasa referans satırıyla karşılaştırın. Belirgin sapma olan günleri inceleyin.",
      },
      {
        stepNumber: 3,
        title: "Takvim Verilerini Dışa Aktarın",
        description: "PMS veya gelir yönetimi ekibiniz için 30 günlük matrisi elektronik tablo olarak indirmek üzere 'Takvimi Dışa Aktar'a tıklayın.",
      },
    ],
    deepDiveSections: [
      {
        heading: "Hibrit Trend Hattı",
        content:
          "Takvim, yükleme sürelerini 200 ms altında tutmak için hibrit rollup hattımızı kullanır: yakın tarihler için canlı fiyat kayıtlarını, makro trendler için günlük özetleri sorgular.",
      },
    ],
    faqs: [
      {
        question: "30 günden ileri tarihleri tarayabilir miyim?",
        answer: "Evet, kurumsal paketlerde 90 veya 180 güne kadar ileri tarihli tarama planları yapılandırılabilir.",
      },
    ],
  },
  {
    id: "discovery-engine",
    slug: "ai-competitor-discovery-radar",
    title: "Yapay Zeka Keşif Motoru: Vektör Anlamsal Rakip Eşleştirme",
    subtitle: "Gözden kaçan gizli rakipleri bulmak için pgvector ve Gemini gömmelerini (embeddings) kullanma",
    category: "Market Analysis",
    readTime: "4 dk okuma",
    iconName: "Radar",
    badge: "Yapay Zeka",
    summary:
      "Geleneksel araçlar rakipleri yalnızca GPS yarıçapına göre bulur. HotelPlus Keşif Motoru (/analysis/discovery), misafir profilleri, olanaklar ve fiyat bantlarının 1536 boyutlu anlamsal vektörlerini oluşturur.",
    video: {
      title: "Anlamsal Yapay Zeka ile Gizli Rakipleri Keşfedin",
      duration: "02:30",
      embedUrl: "https://www.youtube-nocookie.com/embed/5qap5aO4i9A",
      previewPoster: "https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?auto=format&fit=crop&w=1200&q=80",
      chapters: [
        { time: "00:00", title: "GPS Mesafesi Neden Yetersiz?", description: "Butik lüks bir otel yanındaki bütçe moteliyle rekabet etmez." },
        { time: "00:50", title: "Vektör Keşfi Nasıl Çalışır?", description: "Olanak eşleştirme, misafir yaşam tarzı ve fiyat kademesi." },
        { time: "01:40", title: "Keşfedilen Rakipleri Ekleme", description: "Canlı izleme tablonuza tek tıkla ekleme." },
      ],
      keyTakeaways: [
        "5 kilometre uzakta olsa bile tam misafir profilinizi paylaşan otelleri keşfeder.",
        "Milisaniye hızında anlamsal benzerlik puanları için HNSW vektör indeksleme kullanır.",
      ],
    },
    screenMockup: {
      screenType: "rate-calendar",
      caption: "Rakip Keşif Radarı: Anlamsal eşleşme puanı ve rakip önerileri",
      hotspots: [
        {
          id: "hs-disc-score",
          pinNumber: 1,
          label: "Benzerlik Skoru",
          xPercent: 75,
          yPercent: 30,
          title: "Anlamsal Eşleşme Yüzdesi",
          description: "Olanaklar, yıldız puanı, ambiyans ve misafir segmentine göre benzerlik puanı hesaplar (örn. %94 eşleşme).",
        },
        {
          id: "hs-disc-add",
          pinNumber: 2,
          label: "Tek Tıkla Ekle",
          xPercent: 85,
          yPercent: 55,
          title: "Aktif Sepete Ekle",
          description: "Bu yeni keşfedilen oteli canlı Google Hotels panelinizde izlemeye başlamak için tıklayın.",
        },
      ],
    },
    objectives: [
      "Geleneksel yarıçap filtrelerinin gözden kaçırdığı gerçek rakip otelleri bulma",
      "Hedef tesisinize göre benzerlik puanlarını kıyaslama",
      "Rakip sepetinizi tek tıkla genişletme",
    ],
    steps: [
      {
        stepNumber: 1,
        title: "`/analysis/discovery` Sayfasına Gidin",
        description: "Motor, bölgesel otel veritabanımıza karşı arka planda vektör benzerlik sorgusu çalıştırır.",
      },
      {
        stepNumber: 2,
        title: "Benzerlik Parçalarını İnceleyin",
        description: "'Butik Tasarım', 'Yönetici İş Seyahati', 'Spa & Sağlık' gibi eşleşen etiketleri inceleyin.",
      },
      {
        stepNumber: 3,
        title: "Panoya Ekleyin",
        description: "Taramaları planlamak ve piyasa nabzı hesaplamalarına dahil etmek için 'Oteli Takip Et'e tıklayın.",
      },
    ],
    deepDiveSections: [
      {
        heading: "Anlamsal Keşfin Matematiksel Altyapısı",
        content:
          "Google'ın metin gömme modellerini kullanarak PostgreSQL pgvector üzerinde vektörler saklıyoruz. Sorgu; otel açıklamaları, olanak listeleri ve hedef kitleler üzerinde kosinüs mesafesini hesaplayarak adayları sıralar.",
      },
    ],
    faqs: [
      {
        question: "Arama benim şehrim sınırlarında mı kalır?",
        answer: "Evet, tüm önerilen rakiplerin pazarınızla doğrudan ilgili olması için hedef şehir ve bölgeye göre filtrelenir.",
      },
    ],
  },
  {
    id: "parity-alerts",
    slug: "rate-parity-monitoring-alerts",
    title: "Fiyat Paritesi İzleme & İhlal Uyarıları",
    subtitle: "Otomatik ihlal tespiti, uyarı eşikleri ve OTA itirazları için zaman damgalı kanıt toplama",
    category: "Alerts & Parity",
    readTime: "5 dk okuma",
    iconName: "ShieldAlert",
    badge: "Gelir Koruma",
    summary:
      "OTA'lar doğrudan fiyatınızın altına indiğinde veya yetkisiz indirimler uyguladığında doğrudan rezervasyon kaybedersiniz. Otomatik uyarılar kurun ve kanıt dosyasını dışa aktarın.",
    video: {
      title: "Fiyat Paritesini Koruma & OTA İtirazlarını Kazanma",
      duration: "03:15",
      embedUrl: "https://www.youtube-nocookie.com/embed/9bZkp7q19f0",
      previewPoster: "https://images.unsplash.com/photo-1571003123894-1f0594d2b5d9?auto=format&fit=crop&w=1200&q=80",
      chapters: [
        { time: "00:00", title: "Parite İhlallerinin Yüksek Maliyeti", description: "OTA'lar fiyat kırdığında doğrudan rezervasyonlar neden kaybolur?" },
        { time: "00:45", title: "Parite Eşiklerini Yapılandırma", description: "Yüzde ve tutar sapma limitlerini ayarlama." },
        { time: "01:30", title: "Parite İhlal Kartlarını İnceleme", description: "Satıcı kimliklerini ve fiyat farklarını okuma." },
        { time: "02:15", title: "İtiraz Kanıt Dosyası Oluşturma", description: "OTA pazar yöneticinize göndermek üzere denetim kayıtlarını indirme." },
      ],
      keyTakeaways: [
        "Yalnızca kabul edilebilir tamponu aşan fiyat kırmalarda (örn. >%2) bildirim alacak şekilde uyarı hassasiyeti belirleyin.",
        "Her ihlal; tam zaman damgasını, satıcı adını, para birimini ve oda kategorisini kaydeder.",
      ],
    },
    screenMockup: {
      screenType: "parity-monitor",
      caption: "Fiyat Parite Monitörü: OTA kanallarında tespit edilen canlı ihlal akışı",
      hotspots: [
        {
          id: "hs-parity-flag",
          pinNumber: 1,
          label: "İhlal Farkı",
          xPercent: 30,
          yPercent: 40,
          title: "Fiyat Farkı Tutarı",
          description: "OTA'nın doğrudan fiyatınızı tam olarak ne kadar kırdığını gösterir (örn. -$18 / -%12).",
        },
        {
          id: "hs-parity-channel",
          pinNumber: 2,
          label: "Kural Dışı Kanal",
          xPercent: 18,
          yPercent: 55,
          title: "Kanal Tespiti",
          description: "Sızıntının Agoda Özel Fiyatları, Booking.com Genius veya Expedia Üye Fırsatları'ndan kaynaklandığını tanımlar.",
        },
      ],
    },
    objectives: [
      "Parite ihlalleri için e-posta ve uygulama içi otomatik bildirimleri yapılandırma",
      "Doğrudan fiyatınızı ihlal eden spesifik OTA kanalını belirleme",
      "Yetkisiz indirimlere itiraz etmek için zaman damgalı adli kayıtları dışa aktarma",
    ],
    steps: [
      {
        stepNumber: 1,
        title: "Parite Monitörüne Erişin (/analysis/parity)",
        description: "Mevcut parite sağlık endeksini ve aktif ihlaller listesini inceleyin.",
      },
      {
        stepNumber: 2,
        title: "Uyarı Ayarlarını Açın",
        description: "Üst başlıktaki zil simgesine tıklayın. Bildirim eşiğinizi ayarlayın (örn. >$5 fiyat kırıldığında bildir).",
      },
      {
        stepNumber: 3,
        title: "İtiraz Dosyası Oluşturun",
        description: "Pazar yöneticinize gönderilmeye hazır zaman damgalı rapor oluşturmak için 'İhlal Dosyasını Dışa Aktar'a tıklayın.",
      },
    ],
    deepDiveSections: [
      {
        heading: "Gizli OTA İndirim Taktiklerini Yakalama",
        content:
          "Pek çok OTA; sadece mobilde geçerli indirimler, coğrafi hedefli fiyatlar veya paket indirimleri uygulayarak standart kontrolleri atlatır. HotelPlus'ın dağıtık tarayıcısı, bu gizli sızıntıları yakalamak için farklı kullanıcı kimliklerini (user agents) simüle eder.",
      },
    ],
    faqs: [
      {
        question: "HotelPlus kanal yöneticimi otomatik güncelleyebilir mi?",
        answer: "Kurumsal planlarda desteklenen kanal yöneticilerinde otomatik güncelleme tetiklemek için API webhook entegrasyonu sunuyoruz.",
      },
    ],
  },
  {
    id: "copilot-ai",
    slug: "gemini-autonomous-copilot",
    title: "Otonom Yapay Zeka Copilot & Fiyatlandırma DNA'sı",
    subtitle: "Doğal dilde piyasa muhakemesi, Gemini 3.1 Pro entegrasyonu ve strateji sentezi",
    category: "AI & Copilot",
    readTime: "5 dk okuma",
    iconName: "Sparkles",
    badge: "Yeni Nesil AI",
    summary:
      "HotelPlus Copilot, Gemini 3.1 Pro tarafından desteklenen otonom bir akıl yürütme motorudur. Yalnızca ham sayıları sunmak yerine rakiplerin fiyatlarını NEDEN değiştirdiğini açıklar.",
    video: {
      title: "Yapay Zeka Copilot ile Doğal Dilde Gelir Stratejisi",
      duration: "02:50",
      embedUrl: "https://www.youtube-nocookie.com/embed/kJQP7kiw5Fk",
      previewPoster: "https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=1200&q=80",
      chapters: [
        { time: "00:00", title: "Copilot'u Başlatma", description: "Herhangi bir sayfadan kayan AI panelini açma." },
        { time: "00:40", title: "Taktik Sorular Sorma", description: "Piyasa değişimlerini günlük dilde sorgulama." },
        { time: "01:25", title: "Fiyatlandırma DNA Sentezi", description: "Gelir Odaklı vs Hacim Odaklı rakip davranışlarını anlama." },
        { time: "02:10", title: "Uygulanabilir Tavsiyeler", description: "Anlık fiyat düzeltme önerileri alma." },
      ],
      keyTakeaways: [
        "'Gelecek cumartesi rakip doluluğuna göre fiyat artırmalı mıyım?' gibi doğrudan sorular sorun.",
        "Copilot rakip Fiyatlandırma DNA'sını ve tarihsel fiyat hızını otomatik değerlendirir.",
        "Yanıtlar sıfır halüsinasyonla gerçek, canlı tarama verilerine dayanır.",
      ],
    },
    screenMockup: {
      screenType: "copilot-panel",
      caption: "Copilot AI Asistanı: Doğal dilde gelir istihbaratı ve strateji sohbeti",
      hotspots: [
        {
          id: "hs-copilot-input",
          pinNumber: 1,
          label: "İstem Giriş Çubuğu",
          xPercent: 50,
          yPercent: 88,
          title: "Doğal Dilde Soru Sorma",
          description: "Sorularınızı yazın veya 'Hafta sonu talebini analiz et', 'Parite sızıntılarını özetle' gibi hazır istem çiplerini tıklayın.",
        },
        {
          id: "hs-copilot-dna",
          pinNumber: 2,
          label: "Fiyatlandırma DNA Analizi",
          xPercent: 45,
          yPercent: 35,
          title: "Rakip Stratejisi Sınıflandırması",
          description: "Copilot rakipleri 'Hacim Odaklı' (agresif indirim yapan) veya 'Gelir Odaklı' (RevPAR için fiyatını koruyan) olarak sınıflandırır.",
        },
      ],
    },
    objectives: [
      "Piyasa istihbaratını sorgulamak için doğal dili kullanma",
      "Rakip davranış türlerini anlama (Gelir Odaklı vs Hacim Odaklı)",
      "Doluluk hedeflerinize özel uygulanabilir günlük fiyat önerileri alma",
    ],
    steps: [
      {
        stepNumber: 1,
        title: "Copilot Parıltı Simgesine Tıklayın",
        description: "Herhangi bir panel ekranının sağ tarafındaki Copilot çekmecesini açın.",
      },
      {
        stepNumber: 2,
        title: "Önerilen Bir Strateji İstemi Seçin",
        description: "'Piyasa Hızını Analiz Et'i seçin veya belirli tarihlerle ilgili kendi sorunuzu yazın.",
      },
      {
        stepNumber: 3,
        title: "Yapay Zeka Mantığını ve Önerisini İnceleyin",
        description: "Copilot rakip fiyatlarını eşitlemeniz, korumanız veya kırmanız gerekip gerekmediğini gerekçesiyle açıklar.",
      },
    ],
    deepDiveSections: [
      {
        heading: "Dinamik Yapay Zeka Model Kademesi",
        content:
          "Copilot, `ai_config.py` içinde tanımlanan çok katmanlı model kademesinden yararlanır. Derin stratejik muhakeme için varsayılan olarak `gemini-3.1-pro-preview` kullanır; kesinti olmaması için otomatik dinamik geçiş yapar.",
      },
    ],
    faqs: [
      {
        question: "Copilot otelimin verilerini herkese açık olarak paylaşır mı?",
        answer: "Hayır. Tüm Copilot sorguları güvenli, izole kiracı çalışma alanınız içinde çalıştırılır.",
      },
    ],
  },
  {
    id: "reports-exports",
    slug: "executive-reports-exports",
    title: "Yönetici Raporları & PMS Veri Dışa Aktarımı",
    subtitle: "PDF denetim paketleri oluşturma, zamanlanmış CSV dışa aktarımları ve paylaşım",
    category: "Reports & Admin",
    readTime: "4 dk okuma",
    iconName: "FileText",
    badge: "Raporlama",
    summary:
      "Otel sahipleri ve genel müdürler için sunuma hazır temiz PDF raporları dışa aktarın veya PMS/Excel sistemlerine yüklemek için ham CSV fiyat kayıtlarını indirin.",
    video: {
      title: "Yönetici Parite & Fiyatlandırma Raporları Oluşturma",
      duration: "02:10",
      embedUrl: "https://www.youtube-nocookie.com/embed/ScMzIvxBSi4",
      previewPoster: "https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&w=1200&q=80",
      chapters: [
        { time: "00:00", title: "Raporlara Genel Bakış", description: "Kullanılabilir şablonlar ve dışa aktarım formatları." },
        { time: "00:45", title: "Rapor Parametrelerini Özelleştirme", description: "Tarih filtreleri, rakip seçimi ve metrikler." },
        { time: "01:25", title: "PDF ve CSV İndirme", description: "Tek tıkla denetim paketlerini indirme." },
      ],
      keyTakeaways: [
        "Yönetici sunumları için biçimlendirilmiş tek tıkla PDF raporları oluşturun.",
        "Excel veya PMS'te özel analiz için temiz CSV veri kümelerini dışa aktarın.",
      ],
    },
    screenMockup: {
      screenType: "dashboard-grid",
      caption: "Raporlar Konsolu: Rapor oluşturucu ve dışa aktarma seçenekleri",
      hotspots: [
        {
          id: "hs-rep-export",
          pinNumber: 1,
          label: "Dışa Aktarma Butonları",
          xPercent: 80,
          yPercent: 20,
          title: "Tek Tıkla PDF & CSV",
          description: "Yönetim kurulu toplantıları veya PMS entegrasyonu için anında indirilebilir dosyalar üretir.",
        },
      ],
    },
    objectives: [
      "Sunuma hazır yönetici PDF parite raporları üretme",
      "Tarihsel fiyat hareketlerini içeren CSV veri setlerini indirme",
      "Haftalık veya aylık otomatik e-posta raporları planlama",
    ],
    steps: [
      {
        stepNumber: 1,
        title: "Raporlar Sayfasına Gidin (/reports)",
        description: "Rapor şablonunu seçin: Parite İhlal Denetimi veya Piyasa Hızı Özeti.",
      },
      {
        stepNumber: 2,
        title: "Tarih Aralığını ve Rakipleri Seçin",
        description: "Rapor kapsamına dahil etmek istediğiniz otelleri ve tarihleri filtreleyin.",
      },
      {
        stepNumber: 3,
        title: "'PDF Oluştur' veya 'CSV İndir'e Tıklayın",
        description: "Sistem dosyayı derler ve tarayıcınıza anında indirir.",
      },
    ],
    deepDiveSections: [
      {
        heading: "Kurumsal Rapor Derleyicisi",
        content:
          "PDF oluşturucu, yüksek çözünürlüklü vektör grafikler ve sayfa sonu optimizasyonları ile biçimlendirilmiş belgeler üretir.",
      },
    ],
    faqs: [
      {
        question: "Raporlar şirketimin logosunu içerecek şekilde beyaz etiketlenebilir mi?",
        answer: "Evet, kurumsal hesaplar otel veya yönetim grubu logosunu ekleyebilir.",
      },
    ],
  },
];
