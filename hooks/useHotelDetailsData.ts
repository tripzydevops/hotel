import { HotelWithPrice } from "@/types";

export function useHotelDetailsData(hotel: HotelWithPrice | null) {
  if (!hotel) return { 
    other_sites_reviews: [], 
    sentiment_breakdown: [], 
    guest_mentions: [], 
    rating_distribution: [], 
    normalizedImages: [] 
  };

  // Fix the "reviews" type mismatch
  const reviewsObj = hotel?.reviews as any;
  const priceInfoReviewsObj = (hotel?.price_info as any)?.reviews as any;

  // Extract other_sites_reviews
  let other_sites_reviews: any[] = [];
  if (Array.isArray(hotel?.other_sites_reviews) && hotel.other_sites_reviews.length > 0) {
    other_sites_reviews = hotel.other_sites_reviews;
  } else if (reviewsObj && Array.isArray(reviewsObj.other_sites_reviews) && reviewsObj.other_sites_reviews.length > 0) {
    other_sites_reviews = reviewsObj.other_sites_reviews;
  } else if (priceInfoReviewsObj && Array.isArray(priceInfoReviewsObj.other_sites_reviews) && priceInfoReviewsObj.other_sites_reviews.length > 0) {
    other_sites_reviews = priceInfoReviewsObj.other_sites_reviews;
  } else if (hotel?.price_info && Array.isArray((hotel.price_info as any).other_sites_reviews) && (hotel.price_info as any).other_sites_reviews.length > 0) {
    other_sites_reviews = (hotel.price_info as any).other_sites_reviews;
  }

  // Normalize other_sites_reviews to handle nested rating objects
  other_sites_reviews = other_sites_reviews.map(site => ({
    ...site,
    rating: typeof site.rating === 'object' ? site.rating.value : site.rating,
    rating_max: typeof site.rating === 'object' ? (site.rating.max || site.rating_max || 5) : (site.rating_max || 5),
    review_count: typeof site.rating === 'object' ? (site.rating.count || site.review_count) : site.review_count
  }));

  // Extract sentiment_breakdown
  let sentiment_breakdown: any[] = [];
  if (Array.isArray(hotel?.sentiment_breakdown) && hotel.sentiment_breakdown.length > 0) {
    sentiment_breakdown = hotel.sentiment_breakdown;
  } else if (reviewsObj && Array.isArray(reviewsObj.sentiment_breakdown) && reviewsObj.sentiment_breakdown.length > 0) {
    sentiment_breakdown = reviewsObj.sentiment_breakdown;
  } else if (priceInfoReviewsObj && Array.isArray(priceInfoReviewsObj.sentiment_breakdown) && priceInfoReviewsObj.sentiment_breakdown.length > 0) {
    sentiment_breakdown = priceInfoReviewsObj.sentiment_breakdown;
  }

  // Normalize sentiment_breakdown to ensure rating exists
  sentiment_breakdown = sentiment_breakdown.map(theme => {
    let rating = theme.rating;
    if (rating === undefined && theme.total > 0) {
      rating = ((theme.positive || 0) / theme.total) * 5;
    }
    return { ...theme, rating: rating || 0 };
  });

  // Extract guest_mentions
  let guest_mentions: any[] = [];
  if (Array.isArray(hotel?.guest_mentions) && hotel.guest_mentions.length > 0) {
    guest_mentions = hotel.guest_mentions;
  } else if (reviewsObj && Array.isArray(reviewsObj.guest_mentions) && reviewsObj.guest_mentions.length > 0) {
    guest_mentions = reviewsObj.guest_mentions;
  } else if (reviewsObj && Array.isArray(reviewsObj.mentions) && reviewsObj.mentions.length > 0) {
    guest_mentions = reviewsObj.mentions;
  } else if (priceInfoReviewsObj && Array.isArray(priceInfoReviewsObj.guest_mentions) && priceInfoReviewsObj.guest_mentions.length > 0) {
    guest_mentions = priceInfoReviewsObj.guest_mentions;
  } else if (priceInfoReviewsObj && Array.isArray(priceInfoReviewsObj.mentions) && priceInfoReviewsObj.mentions.length > 0) {
    guest_mentions = priceInfoReviewsObj.mentions;
  }

  // Normalize guest_mentions to match expected keys
  guest_mentions = guest_mentions.map(mention => ({
    ...mention,
    keyword: mention.keyword || mention.title,
    count: mention.count || mention.total_count,
    sentiment: mention.sentiment || (
      (mention.positive_count || 0) > (mention.negative_count || 0) ? "positive" : 
      ((mention.negative_count || 0) > (mention.positive_count || 0) ? "negative" : "neutral")
    )
  }));

  // Extract rating_distribution
  let rating_distribution: any[] = [];
  let raw_dist = hotel?.rating_distribution || reviewsObj?.rating_distribution || priceInfoReviewsObj?.rating_distribution;

  if (Array.isArray(raw_dist)) {
    rating_distribution = raw_dist;
  } else if (raw_dist && typeof raw_dist === 'object') {
    rating_distribution = Object.entries(raw_dist).map(([key, value]) => ({
      rating: parseInt(key),
      count: Number(value)
    }));
  }

  // Normalize images to always be an array of objects
  const rawImages = hotel.images || [];
  const normalizedImages = rawImages.map(img => {
    if (typeof img === 'string') {
      return { original: img, thumbnail: img };
    }
    return {
      original: img.original || img.thumbnail || "",
      thumbnail: img.thumbnail || img.original || ""
    };
  }).filter(img => img.original || img.thumbnail);

  // If we have a main image_url and it's not in the gallery, add it at the beginning
  if (hotel.image_url && !normalizedImages.some(img => img.original === hotel.image_url || img.thumbnail === hotel.image_url)) {
    normalizedImages.unshift({ original: hotel.image_url, thumbnail: hotel.image_url });
  }

  return {
    other_sites_reviews,
    sentiment_breakdown,
    guest_mentions,
    rating_distribution,
    normalizedImages
  };
}
