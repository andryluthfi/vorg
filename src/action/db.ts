import { getAllMovies, getAllTVShows, getAllTVEpisodes } from '../infrastructure/database';

export async function handleDbShow() {
  console.log('📊 Database Contents\n');

  const movies = getAllMovies();
  const tvShows = getAllTVShows();
  const tvEpisodes = getAllTVEpisodes();

  if (movies.length > 0) {
    console.log('🎥 Movies:');
    console.table(movies.map(m => ({
      Title: m.title,
      Year: m.year,
      Genre: m.genre,
      Rating: m.imdbRating,
      IMDbID: m.imdbID
    })));
    console.log();
  } else {
    console.log('🎥 No movies in database.\n');
  }

  if (tvShows.length > 0) {
    console.log('📺 TV Shows:');
    console.table(tvShows.map(s => ({
      Title: s.title,
      Year: s.year,
      Genre: s.genre,
      Rating: s.imdbRating,
      Seasons: s.totalSeasons,
      IMDbID: s.imdbID
    })));
    console.log();
  } else {
    console.log('📺 No TV shows in database.\n');
  }

  if (tvEpisodes.length > 0) {
    console.log('📺 TV Episodes:');
    console.table(tvEpisodes.map(e => ({
      Series: e.title,
      Season: e.season,
      Episode: e.episode,
      Title: e.title,
      Year: e.year,
      Genre: e.genre,
      Rating: e.imdbRating,
      IMDbID: e.imdbID
    })));
  } else {
    console.log('📺 No TV episodes in database.');
  }
}