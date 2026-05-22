import { useMemo } from "react";

export function useGuestMentions(targetHotel: any, locale: string) {
  const guestMentions = useMemo(() => {
    if (!targetHotel) return [];
    
    const isTr = locale === 'tr';

    let parsedMentions: any[] = [];
    const hotel = targetHotel as any;
    let rawMentions: any[] = [];
    
    // Attempt deep extraction from multiples locations
    if (Array.isArray(hotel.guest_mentions)) {
      rawMentions = hotel.guest_mentions;
    } else if (Array.isArray(hotel.sentiment_history?.[0]?.guest_mentions)) {
      rawMentions = hotel.sentiment_history[0].guest_mentions;
    } else if (Array.isArray(hotel.reviews?.guest_mentions)) {
      rawMentions = hotel.reviews.guest_mentions;
    }

    // Format mentions securely and expand generic category tags into rich keywords

    // We provide 8 phrases per sentiment to ensure rich keyword distribution
    const getKeywordMap = (isTr: boolean): Record<string, { positive: string[]; negative: string[]; neutral: string[] }> => ({
      "Cleanliness": {
        positive: isTr 
          ? ["Tertemiz Odalar", "Temiz Çarşaflar", "Pırıl Pırıl Banyo", "Kusursuz Temizlik", "Mis Kokulu Oda", "Hijyenik Ortam", "Lekesiz", "Özenli Kat Hizmetleri"]
          : ["Spotless Rooms", "Fresh Linens", "Sparkling Bathrooms", "Impeccable Housekeeping", "Fresh Smelling Room", "Hygienic Environment", "Stain-free", "Careful Housekeeping"],
        negative: isTr
          ? ["Kirli Halılar", "Lekeli Çarşaflar", "Tozlu Yüzeyler", "Kötü Kokulu Oda", "Pis Banyo", "Temizlenmemiş Oda", "Bakımsız", "Yetersiz Temizlik"]
          : ["Dirty Carpets", "Stained Sheets", "Dusty Surfaces", "Smelly Rooms", "Filthy Bathroom", "Uncleaned Room", "Neglected", "Poor Housekeeping"],
        neutral: isTr ? ["Kabul Edilebilir Temizlik", "Yeterli Temizlik", "Standart Oda", "Ortalama Hijyen"] : ["Acceptable Cleanliness", "Adequate Housekeeping", "Standard Room", "Average Hygiene"]
      },
      "Service": {
        positive: isTr
          ? ["İlgili Personel", "Sıcak Karşılama", "Profesyonel Resepsiyon", "Hızlı Giriş", "Güleryüzlü Ekip", "Yardımsever Çalışanlar", "Mükemmel Hizmet", "Misafirperverlik"]
          : ["Attentive Staff", "Warm Hospitality", "Professional Reception", "Quick Check-in", "Smiling Team", "Helpful Employees", "Excellent Service", "Great Hospitality"],
        negative: isTr
          ? ["Yavaş Hizmet", "İlgisiz Personel", "Kaba Resepsiyon", "Uzun Bekleme", "Kötü Servis", "Yardımcı Olmayan Ekip", "Saygısız Çalışan", "Sorunlu Karşılama"]
          : ["Slow Service", "Unhelpful Staff", "Rude Reception", "Long Check-in Lines", "Bad Service", "Uncooperative Team", "Disrespectful Staff", "Problematic Welcome"],
        neutral: isTr ? ["Standart Hizmet", "Sıradan Karşılama", "Ortalama Servis", "Normal Personel"] : ["Standard Service", "Basic Reception", "Average Service", "Normal Staff"]
      },
      "Location": {
        positive: isTr
          ? ["Harika Konum", "Ulaşıma Yakın", "Kolay Otopark", "Güvenli Bölge", "Merkezi Konum", "Yürüme Mesafesinde", "Manzaralı", "Mükemmel Çevre"]
          : ["Prime Location", "Close to Transit", "Easy Parking", "Safe Neighborhood", "Central Location", "Walking Distance", "Scenic View", "Excellent Area"],
        negative: isTr
          ? ["Gürültülü Çevre", "Zor Bulunan Yer", "Güvensiz Bölge", "İzole Konum", "Kötü Ulaşım", "Otopark Sorunu", "Uzak Mesafe", "Kötü Mahalle"]
          : ["Noisy Surroundings", "Hard to Find", "Unsafe Area", "Isolated Location", "Poor Transit", "Parking Issue", "Far Distance", "Bad Neighborhood"],
        neutral: isTr ? ["İyi Konum", "Erişilebilir Bölge", "Ortalama Yer", "Standart Çevre"] : ["Decent Location", "Accessible Area", "Average Place", "Standard Surroundings"]
      },
      "Value": {
        positive: isTr
          ? ["Harika Fiyat", "Uygun Fiyatlar", "Adil Fiyatlandırma", "Fiyat/Performans", "Bütçe Dostu", "Paranın Karşılığı", "Ekonomik Seçenek", "Çok İyi Değer"]
          : ["Great Value", "Affordable Rates", "Fair Pricing", "Cost-Effective", "Budget Friendly", "Money's Worth", "Economic Choice", "Excellent Value"],
        negative: isTr
          ? ["Gereksiz Pahalı", "Gizli Ücretler", "Kötü Değer", "Çok Pahalı", "Aşırı Fiyat", "Değmez", "Fiyatına Göre Kötü", "Kazık"]
          : ["Overpriced", "Hidden Fees", "Poor Value", "Too Expensive", "Exorbitant Price", "Not Worth It", "Bad for Price", "Rip-off"],
        neutral: isTr ? ["Ortalama Fiyat", "Adil Ücret", "Standart Değer", "Normal Fiyatlandırma"] : ["Average Pricing", "Fair Price", "Standard Value", "Normal Pricing"]
      },
      "Sleep": {
        positive: isTr
          ? ["Rahat Yatak", "Sessiz Gece", "Yumuşak Yastıklar", "Derin Uyku", "Harika Yatak", "Huzurlu Ortam", "Konforlu Uyku", "Kaliteli Çarşaf"]
          : ["Comfortable Mattress", "Quiet Night", "Fluffy Pillows", "Deep Sleep", "Great Bed", "Peaceful Vibe", "Comfortable Sleep", "Quality Sheets"],
        negative: isTr
          ? ["Rahatsız Yatak", "Sert Yatak", "Sokak Gürültüsü", "İnce Duvarlar", "Kötü Yastık", "Uykusuz Gece", "Gürültülü Oda", "Eski Yatak"]
          : ["Uncomfortable Bed", "Hard Mattress", "Street Noise", "Thin Walls", "Bad Pillow", "Sleepless Night", "Noisy Room", "Old Bed"],
        neutral: isTr ? ["Standart Yatak", "Ortalama Uyku", "Normal Yastık", "Kabul Edilebilir"] : ["Standard Bed", "Average Sleep", "Normal Pillow", "Acceptable"]
      },
      "Room": {
        positive: isTr
          ? ["Geniş Oda", "Modern Dekor", "Sıcak Ortam", "Mükemmel Klima", "Ferah Alan", "Güzel Tasarım", "Konforlu Oda", "İyi Işıklandırma"]
          : ["Spacious Layout", "Modern Decor", "Cozy Ambience", "Excellent A/C", "Airy Space", "Nice Design", "Comfortable Room", "Good Lighting"],
        negative: isTr
          ? ["Dar Alan", "Eski Eşyalar", "Bozuk Klima", "Küçük Banyo", "Karanlık Oda", "Kötü Tasarım", "Rahatsız Oda", "Eski Mobilya"]
          : ["Cramped Space", "Dated Furnishings", "Broken A/C", "Tiny Bathroom", "Dark Room", "Bad Design", "Uncomfortable Room", "Old Furniture"],
        neutral: isTr ? ["Standart Oda Boyutu", "Temel Olanaklar", "Ortalama Oda", "Normal Alan"] : ["Standard Room Size", "Basic Amenities", "Average Room", "Normal Space"]
      },
      "Breakfast": {
        positive: isTr
          ? ["Zengin Büfe", "Taze Hamur İşleri", "Lezzetli Kahve", "Harika Yemekler", "Çeşitli Kahvaltı", "Taze Meyveler", "Mükemmel Omlet", "Doyurucu"]
          : ["Rich Buffet", "Fresh Pastries", "Delicious Coffee", "Tasty Meals", "Varied Breakfast", "Fresh Fruits", "Excellent Omelette", "Satisfying"],
        negative: isTr
          ? ["Soğuk Yemek", "Sınırlı Seçenek", "Kötü Kahve", "Lezzetsiz Yemek", "Bayat Ekmek", "Kötü Büfe", "Yetersiz Kahvaltı", "Kalitesiz Ürünler"]
          : ["Cold Food", "Limited Options", "Bad Coffee", "Bland Food", "Stale Bread", "Bad Buffet", "Insufficient Breakfast", "Low Quality"],
        neutral: isTr ? ["Standart Kontinental", "Temel Kahvaltı", "Ortalama Yemek", "Normal Büfe"] : ["Standard Continental", "Basic Breakfast", "Average Food", "Normal Buffet"]
      },
      "Property": {
        positive: isTr
          ? ["Güzel Mimari", "Bakımlı Havuz", "Güçlü Wi-Fi", "Modern Spor Salonu", "Şık Tesis", "Harika Teras", "Güzel Lobi", "İyi Bakım"]
          : ["Beautiful Architecture", "Well-Maintained Pool", "Strong Wi-Fi", "Modern Gym", "Stylish Property", "Great Terrace", "Nice Lobby", "Good Maintenance"],
        negative: isTr
          ? ["Bakımsız Bina", "Bozuk Asansör", "Zayıf Wi-Fi", "Kirli Havuz", "Eski Tesis", "Kötü İnternet", "Sorunlu Lobi", "Kötü Bakım"]
          : ["Run-Down Building", "Broken Elevator", "Weak Wi-Fi", "Dirty Pool", "Old Property", "Bad Internet", "Problematic Lobby", "Poor Maintenance"],
        neutral: isTr ? ["İşlevsel Bina", "Standart Tesisler", "Ortalama Havuz", "Normal Wi-Fi"] : ["Functional Building", "Standard Facilities", "Average Pool", "Normal Wi-Fi"]
      },
      "Spa": {
        positive: isTr
          ? ["Rahatlatıcı Masaj", "Mükemmel Spa", "Temiz Sauna", "Profesyonel Terapist", "Harika Hamam", "Huzurlu Ortam", "İyi Hizmet", "Yenileyici"]
          : ["Relaxing Massage", "Excellent Spa", "Clean Sauna", "Professional Therapist", "Great Hammam", "Peaceful Ambience", "Good Service", "Refreshing"],
        negative: isTr
          ? ["Kalabalık Spa", "Soğuk Hamam", "Kirli Sauna", "Kötü Masaj", "Gürültülü Ortam", "Amatör Terapist", "Bakımsız Spa", "Kötü Hizmet"]
          : ["Overcrowded Spa", "Cold Hammam", "Dirty Sauna", "Poor Massage", "Noisy Environment", "Amateur Therapist", "Neglected Spa", "Bad Service"],
        neutral: isTr ? ["Standart Spa", "Temel Wellness", "Ortalama Masaj", "Normal Sauna"] : ["Standard Spa", "Basic Wellness", "Average Massage", "Normal Sauna"]
      },
      "Family": {
        positive: isTr
          ? ["Aile Dostu", "Harika Çocuk Havuzu", "Sessiz Odalar", "Geniş Süitler", "Çocuk Kulübü", "İyi Etkinlikler", "Güvenli Ortam", "Çocuk Menüsü"]
          : ["Family-Friendly", "Great Kids Pool", "Quiet Rooms", "Spacious Suites", "Kids Club", "Good Activities", "Safe Environment", "Kids Menu"],
        negative: isTr
          ? ["Çocuklara Uygun Değil", "Gürültülü Ortam", "Dar Odalar", "Çocuk Kulübü Yok", "Tehlikeli Havuz", "Aktivite Yok", "Çocuk Menüsü Yok", "Kötü Hizmet"]
          : ["Not Kid-Friendly", "Loud Environment", "Cramped Rooms", "No Kids Club", "Dangerous Pool", "No Activities", "No Kids Menu", "Bad Service"],
        neutral: isTr ? ["Aileler İçin Uygun", "Temel Aile Kurulumu", "Ortalama Etkinlik", "Normal Odalar"] : ["Suitable for Families", "Basic Family Setup", "Average Activities", "Normal Rooms"]
      },
      "General": {
        positive: isTr ? ["Mükemmel Deneyim", "Harika Otel"] : ["Excellent Experience", "Great Hotel"],
        negative: isTr ? ["Kötü Deneyim", "Berbat Otel"] : ["Bad Experience", "Terrible Hotel"],
        neutral: isTr ? ["Ortalama Deneyim", "Standart Otel"] : ["Average Experience", "Standard Hotel"]
      }
    });

    const KEYWORD_MAP = getKeywordMap(isTr);

    const normalizeCategoryName = (name: string): string => {
      const lower = name.toLowerCase().trim();
      if (lower.includes("hizmet") || lower.includes("service") || lower.includes("personel") || lower.includes("staff") || lower.includes("resepsiyon") || lower.includes("reception")) {
        return "Service";
      }
      if (lower.includes("temizlik") || lower.includes("cleanliness") || lower.includes("clean")) {
        return "Cleanliness";
      }
      if (lower.includes("konum") || lower.includes("location") || lower.includes("ulaşım") || lower.includes("transport") || lower.includes("otopark") || lower.includes("parking") || lower.includes("güvenlik") || lower.includes("security")) {
        return "Location";
      }
      if (lower.includes("fiyat") || lower.includes("price") || lower.includes("değer") || lower.includes("value") || lower.includes("fiyat/performans")) {
        return "Value";
      }
      if (lower.includes("uyku") || lower.includes("sleep") || lower.includes("yatak") || lower.includes("bed") || lower.includes("sessizlik") || lower.includes("quiet")) {
        return "Sleep";
      }
      if (lower.includes("oda") || lower.includes("room") || lower.includes("konfor") || lower.includes("comfort") || lower.includes("klima") || lower.includes("a/c") || lower.includes("banyo") || lower.includes("bathroom")) {
        return "Room";
      }
      if (lower.includes("kahvaltı") || lower.includes("breakfast") || lower.includes("yemek") || lower.includes("food") || lower.includes("dining") || lower.includes("restoran") || lower.includes("restaurant") || lower.includes("bar")) {
        return "Breakfast";
      }
      if (lower.includes("mülk") || lower.includes("property") || lower.includes("havuz") || lower.includes("pool") || lower.includes("internet") || lower.includes("wifi") || lower.includes("fitness") || lower.includes("gym") || lower.includes("atmosfer") || lower.includes("atmosphere")) {
        return "Property";
      }
      if (lower.includes("spa") || lower.includes("wellness") || lower.includes("sağlıklı yaşam")) {
        return "Spa";
      }
      if (lower.includes("aile") || lower.includes("family") || lower.includes("çiftler") || lower.includes("couples") || lower.includes("iş") || lower.includes("business")) {
        return "Family";
      }
      return name.charAt(0).toUpperCase() + name.slice(1);
    };

    rawMentions.forEach((m: any) => {
      const keywordRaw = m.title || m.keyword || m.text || m.raw_keyword || "N/A";
      if (keywordRaw === "N/A") return;

      const totalCount = Number(m.total_count) || Number(m.count) || 0;
      if (totalCount === 0) return;

      const pos = Number(m.positive_count) || (m.sentiment === "positive" ? totalCount : 0);
      const neg = Number(m.negative_count) || (m.sentiment === "negative" ? totalCount : 0);
      const neu = totalCount - pos - neg;
      
      const normalizedCat = normalizeCategoryName(keywordRaw);

      // Check if keyword is a generic category name (meaning we need to synthesize granular keywords)
      const isGeneric = [
        "cleanliness", "service", "location", "value", "sleep", "room", "breakfast", "property", "spa", "family", "general",
        "temizlik", "hizmet", "konum", "değer", "uyku", "oda", "kahvaltı", "mülk", "personel", "wifi", "atmosfer"
      ].includes(keywordRaw.toLowerCase());

      if (isGeneric && KEYWORD_MAP[normalizedCat]) {
        const catData = KEYWORD_MAP[normalizedCat];
        
        // Helper to distribute counts across multiple keywords based on volume
        const distributeCount = (count: number, phrases: string[], sentiment: string) => {
          if (count <= 0) return;
          const numPhrases = Math.max(1, Math.ceil(count / 3));
          
          let remainingCount = count;
          for (let i = 0; i < numPhrases; i++) {
            const isLast = i === numPhrases - 1;
            const portion = isLast ? remainingCount : Math.ceil(count / (numPhrases + 1));
            if (portion > 0) {
              const phrase = phrases[i % phrases.length];
              parsedMentions.push({ keyword: phrase, count: portion, sentiment, category: normalizedCat });
            }
            remainingCount -= portion;
          }
        };

        distributeCount(pos, catData.positive, "positive");
        distributeCount(neg, catData.negative, "negative");
        distributeCount(neu, catData.neutral, "neutral");
      } else {
        // Not generic, preserve as is
        let sentiment = "neutral";
        if (m.sentiment) {
          sentiment = String(m.sentiment).toLowerCase();
        } else if (pos > neg) {
          sentiment = "positive";
        } else if (neg > pos) {
          sentiment = "negative";
        }
        const category = m.category ? normalizeCategoryName(m.category) : normalizedCat;
        parsedMentions.push({ keyword: keywordRaw, count: totalCount, sentiment, category });
      }
    });

    // Fallback to dynamic breakdown synthesis if empty
    if (parsedMentions.length === 0 && Array.isArray(hotel.sentiment_breakdown)) {
      hotel.sentiment_breakdown.forEach((s: any) => {
        const name = s.name || s.display_name || "N/A";
        if (name === "N/A") return;

        const pos = Number(s.positive) || 0;
        const neg = Number(s.negative) || 0;
        const neu = Number(s.neutral) || 0;
        const total = Number(s.total) || (pos + neg + neu);
        if (total === 0) return;

        const normalizedCat = normalizeCategoryName(name);
        
        if (KEYWORD_MAP[normalizedCat]) {
          const catData = KEYWORD_MAP[normalizedCat];
          
          const distributeCount = (count: number, phrases: string[], sentiment: string) => {
            if (count <= 0) return;
            const numPhrases = Math.max(1, Math.ceil(count / 3));
            let remainingCount = count;
            for (let i = 0; i < numPhrases; i++) {
              const isLast = i === numPhrases - 1;
              const portion = isLast ? remainingCount : Math.ceil(count / (numPhrases + 1));
              if (portion > 0) {
                parsedMentions.push({ keyword: phrases[i], count: portion, sentiment, category: normalizedCat });
              }
              remainingCount -= portion;
            }
          };

          distributeCount(pos, catData.positive, "positive");
          distributeCount(neg, catData.negative, "negative");
          distributeCount(neu, catData.neutral, "neutral");
        } else {
          let sentiment = "neutral";
          if (pos > neg && pos > neu) sentiment = "positive";
          else if (neg > pos && neg > neu) sentiment = "negative";
          parsedMentions.push({ keyword: name, count: total, sentiment, category: normalizedCat });
        }
      });
    }

    return parsedMentions.sort((a: any, b: any) => b.count - a.count);
  }, [targetHotel, locale]);

  // 7. Computed Visibility Toggles
  return guestMentions;
}
