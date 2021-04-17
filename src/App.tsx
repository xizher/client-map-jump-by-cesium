import React, { useEffect, useState } from 'react'
import {
  WebMap,
  MapEntities,
  MapCamera,
  Basemap,
  MapTools,
} from '@xizher/cesium'
import { MapJumpGame } from './map-jump-game'
import {
  Button
} from '@material-ui/core'

function App () : JSX.Element {
  const divId = 'cesium-container'
  const webMap = new WebMap(divId, {
    baseUrl: '/cesium/v1.79.1/Build/Cesium/',
    debug: true,
  })
    .use(new Basemap())
    .use(new MapEntities())
    .use(new MapCamera())
    .use(new MapTools())

  const [jumpGame, setJumpGame] = useState<MapJumpGame>()
  useEffect(() => {
    if (jumpGame) {
      jumpGame.on('game-start', () => setGameOver(false))
      jumpGame.on('game-over', () => setGameOver(true))
      jumpGame.startGame()
    }
  }, [jumpGame])

  const [gameOver, setGameOver] = useState(false)

  useEffect(() => {
    webMap.mount()
    setJumpGame(new MapJumpGame(webMap))
  }, [])

  return (<>
    <div className="w-screen h-screen" id={ divId }></div>
    <div className="btn-game-reset">
      <Button
        variant="contained"
        size="large"
        onClick={ () => jumpGame && jumpGame.resetGame() }
        style={{
          display: gameOver ? 'block' : 'none'
        }}
      >
        重置游戏
      </Button>
    </div>
  </>)
}

export default App
