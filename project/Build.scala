import sbt._
import Keys._
import play.Project._

object ApplicationBuild extends Build {

  val appName         = "shift-calendar"
  val appVersion      = "1.0-SNAPSHOT"

  val appDependencies = Seq(
    // Add your project dependencies here,
    jdbc,
    anorm,
    "com.google.apis" % "google-api-services-calendar" % "v3-rev60-1.17.0-rc",
    "com.google.http-client" % "google-http-client-jackson2" % "1.17.0-rc",
    "com.google.oauth-client" % "google-oauth-client-jetty" % "1.17.0-rc"

   )


  val main = play.Project(appName, appVersion, appDependencies).settings(
    // Add your own project settings here      
  )

}
